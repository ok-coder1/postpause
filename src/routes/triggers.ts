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
  const cooldownMinutes = ((await settings.get('cooldownMinutes')) as number) ?? 60;
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
    isMod =
      (await reddit.getModerators({ subredditName, username }).all()).length > 0;
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
    const minutesSince = (Date.now() - parseInt(lastPostTime)) / (1000 * 60);

    if (minutesSince < cooldownMinutes) {
      const minutesLeft = (cooldownMinutes - minutesSince).toFixed(1);
      let hoursLeft = '0';
      let moreThanOneHour = false;
      let daysLeft = '0';
      let moreThanOneDay = false;
      if (parseInt(minutesLeft) >= 60) {
        hoursLeft = ((cooldownMinutes - minutesSince) / 60).toFixed(1);
        moreThanOneHour = true;
      }
      if (parseInt(hoursLeft) >= 24) {
        daysLeft = ((cooldownMinutes - minutesSince) / (60 * 24)).toFixed(1);
        moreThanOneDay = true;
      }
      try {
        await reddit.remove(`t3_${postId}`, false);
      } catch (error) {
        console.error('Error removing post ', postId, ': ', error);
      }
      try {
        const isMuted = await redis.get(`muted:${subredditName}:${userId}`);
        if (isMuted != 'true') {
          if (moreThanOneHour) {
            if (moreThanOneDay) {
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
        } else if (isMuted == 'true') {
          if (moreThanOneHour) {
            if (moreThanOneDay) {
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
