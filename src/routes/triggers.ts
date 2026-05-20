import { Hono } from 'hono';
import { reddit } from '@devvit/reddit';
import { redis } from '@devvit/redis';
import { settings } from '@devvit/web/server';
import type {
  OnAppInstallRequest,
  OnPostSubmitRequest,
  TriggerResponse,
} from '@devvit/web/shared';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  const input = await c.req.json<OnAppInstallRequest>();
  const subredditName = input.subreddit?.name;

  console.log('App installed to subreddit: r/', subredditName);

  return c.json<TriggerResponse>(
    {
      status: 'success',
    },
    200
  );
});

triggers.post('/on-post-submit', async (c) => {
  const input = await c.req.json<OnPostSubmitRequest>();
  const userId = input.author?.id;
  const username = input.author?.name;
  const subredditName = input.subreddit?.name;
  const postId = input.post?.id.replace('t3_', '');
  const cooldown = ((await settings.get('cooldownMinutes')) as number) ?? 60;
  const isMuted = await redis.get(`muted:${subredditName}:${userId}`);
  let isMod = false;

  if (!userId || !username || !subredditName || !postId) {
    return c.json<TriggerResponse>(
      {
        status: 'success',
      },
      200
    );
  }

  try {
    isMod = (await reddit.getModerators({ subredditName, username }).all()).length > 0;
  } catch (error) {
    console.error('Error checking if user is a moderator: ', error);
  }

  if (isMod)
  {
    return c.json<TriggerResponse>(
      {
        status: 'success',
      },
      200
    );
  }

  const lastPostTime = await redis.get(`lastpost:${subredditName}:${userId}`);

  if (lastPostTime) {
    const minutesSinceLastPost = (Date.now() - parseInt(lastPostTime)) / (1000 * 60);
    let minutesLeft;

    if (minutesSinceLastPost < cooldown) {
      if (isMuted == 'true') {
        minutesLeft = ((parseInt(lastPostTime) - Date.now()) / (1000 * 60)).toFixed(1);
      } else {
        minutesLeft = (cooldown - minutesSinceLastPost).toFixed(1);
      }
      let hoursLeft = '0';
      let ifMoreThanAnHr = false;
      let daysLeft = '0';
      let ifMoreThanADay = false;
      if (parseFloat(minutesLeft) >= 60) {
        hoursLeft = ((cooldown - minutesSinceLastPost) / 60).toFixed(1);
        ifMoreThanAnHr = true;
      }
      if (parseFloat(hoursLeft) >= 24) {
        daysLeft = ((cooldown - minutesSinceLastPost) / (60 * 24)).toFixed(1);
        ifMoreThanADay = true;
      }
      try {
        if (isMuted != 'true') {
          if (ifMoreThanAnHr) {
            if (ifMoreThanADay) {
              try {
                await reddit.submitComment({
                  id: `t3_${postId}`,
                  text: `Your post was removed because you are on a cooldown. Please wait **${daysLeft} days** before posting again.\n*I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](https://www.reddit.com/message/compose/?to=/r/${subredditName}) if you have any questions or concerns.*`,
                })
              } catch (error) {
                console.error('Error submitting comment to post ', postId, ': ', error);
              }
              await reddit.sendPrivateMessage({
                to: username,
                subject: 'PostPause',
                text: `Your post in **r/${subredditName}** was removed. Please wait for **${daysLeft} days** until you can post again.`,
              });
            } else {
              try {
                await reddit.submitComment({
                  id: `t3_${postId}`,
                  text: `Your post was removed because you are on a cooldown. Please wait **${hoursLeft} hours** before posting again.\n*I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](https://www.reddit.com/message/compose/?to=/r/${subredditName}) if you have any questions or concerns.*`,
                })
              } catch (error) {
                console.error('Error submitting comment to post ', postId, ': ', error);
              }
              await reddit.sendPrivateMessage({
                to: username,
                subject: 'PostPause',
                text: `Your post in **r/${subredditName}** was removed. Please wait for **${hoursLeft} hours** until you can post again.`,
              });
            }
          } else {
            try {
              await reddit.submitComment({
                id: `t3_${postId}`,
                text: `Your post was removed because you are on a cooldown. Please wait **${minutesLeft} minutes** before posting again.\n*I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](https://www.reddit.com/message/compose/?to=/r/${subredditName}) if you have any questions or concerns.*`,
              });
            } catch (error) {
              console.error('Error submitting comment to post ', postId, ': ', error);
            }
            await reddit.sendPrivateMessage({
              to: username,
              subject: 'PostPause',
              text: `Your post in **r/${subredditName}** was removed. Please wait for **${minutesLeft} minutes** until you can post again.`,
            });
          }
        } else {
          if (ifMoreThanAnHr) {
            if (ifMoreThanADay) {
              await reddit.sendPrivateMessage({
                  to: username,
                  subject: 'PostPause',
                  text: `Your post in **r/${subredditName}** was removed. You are currently muted and cannot post for **${daysLeft} days**.`,
                });
            } else {
              await reddit.sendPrivateMessage({
                to: username,
                subject: 'PostPause',
                text: `Your post in **r/${subredditName}** was removed. You are currently muted and cannot post for **${hoursLeft} hours**.`,
              });
            }
          } else {
            await reddit.sendPrivateMessage({
              to: username,
              subject: 'PostPause',
              text: `Your post in **r/${subredditName}** was removed. You are currently muted and cannot post for **${minutesLeft} minutes**.`,
            });
          }
        }
      } catch (error) {
        console.error('Error sending private message to u/', username, ': ', error);
      }
      try {
        await reddit.remove(`t3_${postId}`, false);
      } catch (error) {
        console.error('Error removing post ', postId, ': ', error);
      }

      return c.json<TriggerResponse>(
        {
          status: 'success',
        },
        200
      );
    }
  }

  await redis.set(`lastpost:${subredditName}:${userId}`, Date.now().toString());
  await redis.del(`muted:${subredditName}:${userId}`);

  return c.json<TriggerResponse>(
    {
      status: 'success',
    },
    200
  );
});
