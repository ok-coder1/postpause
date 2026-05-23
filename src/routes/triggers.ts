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
  const postFlair = input.post?.linkFlair?.text;
  let cooldown = await settings.get<number>('cooldownMinutes') ?? 60;

  if (!userId || !username || !subredditName || !postId) {
    return c.json<TriggerResponse>(
      {
        status: 'success',
      },
      200
    );
  }

  const flairsCooldown = await settings.get<string>('flairsCooldown');
  if (flairsCooldown) {
    const linesFlairs = flairsCooldown.split("\n");
    for (const line of linesFlairs) {
      const [flair, cooldownOfFlair] = line.split(":").map(part => part.trim());
      if (flair == postFlair) {
        cooldown = parseFloat(cooldownOfFlair!);
        break;
      }
    }
  }

  const removalMessage = await settings.get<string>('removalMessage') ?? `Your post in r/subredditName was removed. Please wait **timeLeft** before posting again.`;
  const exemptApprovedUsers = await settings.get<boolean>('exemptApprovedUsers') ?? false;
  let isMod = false;
  let isApproved = false;

  try {
    isMod = (await reddit.getModerators({ subredditName, username }).all()).length > 0;
  } catch (error) {
    console.error('Error checking if user is a moderator:', error);
  }

  try {
    isApproved = (await reddit.getApprovedUsers({subredditName, username}).all()).length > 0;
  } catch (error) {
    console.error('Error checking if user is approved:', error);
  }

  if (isMod) {
    return c.json<TriggerResponse>(
      {
        status: 'success',
      },
      200
    );
  }

  if (exemptApprovedUsers) {
    if (isApproved) {
      return c.json<TriggerResponse>(
        {
          status: 'success',
        },
        200
      );
    }
  }

  const lastPostTime = await redis.get(`lastpost:${userId}`);
  const isMuted = await redis.get(`muted:${userId}`);

  if (lastPostTime) {
    const minutesSinceLastPost = (Date.now() - parseInt(lastPostTime)) / (1000 * 60);
    let minutesLeft = '0';
    let hoursLeft = '0';
    let ifMoreThanAnHr = false;
    let daysLeft = '0';
    let ifMoreThanADay = false;

    if (minutesSinceLastPost < cooldown) {
      if (isMuted == 'true') {
        minutesLeft = ((parseInt(lastPostTime) - Date.now()) / (1000 * 60)).toFixed(1);
        if (parseFloat(minutesLeft) >= 60) {
          hoursLeft = ((parseInt(lastPostTime) - Date.now()) / (1000 * 60 * 60)).toFixed(1);
          ifMoreThanAnHr = true;
        }
        if (parseFloat(hoursLeft) >= 24) {
          daysLeft = ((parseInt(lastPostTime) - Date.now()) / (1000 * 60 * 60 * 24)).toFixed(1);
          ifMoreThanADay = true;
        }
      } else {
        minutesLeft = (cooldown - minutesSinceLastPost).toFixed(1);  
        if (parseFloat(minutesLeft) >= 60) {
          hoursLeft = ((cooldown - minutesSinceLastPost) / 60).toFixed(1);
          ifMoreThanAnHr = true;
        }
        if (parseFloat(hoursLeft) >= 24) {
          daysLeft = ((cooldown - minutesSinceLastPost) / (60 * 24)).toFixed(1);
          ifMoreThanADay = true;
        }
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
                console.error('Error submitting comment to post', postId, ':', error);
              }
              await reddit.sendPrivateMessage({
                to: username,
                subject: 'PostPause',
                text: (parseFloat(daysLeft) != 1.0) ? removalMessage.replace('subredditName', subredditName).replace('timeLeft', `${daysLeft} days`) : removalMessage.replace('subredditName', subredditName).replace('timeLeft', `1 day`),
              });
            } else {
              try {
                await reddit.submitComment({
                  id: `t3_${postId}`,
                  text: `Your post was removed because you are on a cooldown. Please wait **${hoursLeft} hours** before posting again.\n*I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](https://www.reddit.com/message/compose/?to=/r/${subredditName}) if you have any questions or concerns.*`,
                })
              } catch (error) {
                console.error('Error submitting comment to post', postId, ':', error);
              }
              await reddit.sendPrivateMessage({
                to: username,
                subject: 'PostPause',
                text: (parseFloat(hoursLeft) != 1.0) ? removalMessage.replace('subredditName', subredditName).replace('timeLeft', `${hoursLeft} hours`) : removalMessage.replace('subredditName', subredditName).replace('timeLeft', `1 hour`),
              });
            }
          } else {
            try {
              await reddit.submitComment({
                id: `t3_${postId}`,
                text: `Your post was removed because you are on a cooldown. Please wait **${minutesLeft} minutes** before posting again.\n*I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](https://www.reddit.com/message/compose/?to=/r/${subredditName}) if you have any questions or concerns.*`,
              });
            } catch (error) {
              console.error('Error submitting comment to post', postId, ':', error);
            }
            await reddit.sendPrivateMessage({
              to: username,
              subject: 'PostPause',
              text: (parseFloat(minutesLeft) != 1.0) ? removalMessage.replace('subredditName', subredditName).replace('timeLeft', `${minutesLeft} minutes`) : removalMessage.replace('subredditName', subredditName).replace('timeLeft', `1 minute`),
          });
        }
        } else {
          if (ifMoreThanAnHr) {
            if (ifMoreThanADay) {
              await reddit.sendPrivateMessage({
                  to: username,
                  subject: 'PostPause',
                  text: (parseFloat(daysLeft) != 1.0) ? removalMessage.replace('subredditName', subredditName).replace('timeLeft', `${daysLeft} days`) : removalMessage.replace('subredditName', subredditName).replace('timeLeft', `1 day`),
                });
            } else {
              await reddit.sendPrivateMessage({
                to: username,
                subject: 'PostPause',
                text: (parseFloat(hoursLeft) != 1.0) ? removalMessage.replace('subredditName', subredditName).replace('timeLeft', `${hoursLeft} hours`) : removalMessage.replace('subredditName', subredditName).replace('timeLeft', `1 hour`),
              });
            }
          } else {
            await reddit.sendPrivateMessage({
              to: username,
              subject: 'PostPause',
              text: (parseFloat(minutesLeft) != 1.0) ? removalMessage.replace('subredditName', subredditName).replace('timeLeft', `${minutesLeft} minutes`) : removalMessage.replace('subredditName', subredditName).replace('timeLeft', `1 minute`),
            });
          }
        }
      } catch (error) {
        console.error('Error sending private message to u/', username, ':', error);
      }
      try {
        await reddit.remove(`t3_${postId}`, false);
      } catch (error) {
        console.error('Error removing post', postId, ':', error);
      }

      return c.json<TriggerResponse>(
        {
          status: 'success',
        },
        200
      );
    }
  }

  await redis.set(`lastpost:${userId}`, Date.now().toString());
  await redis.expire(`lastpost:${userId}`, cooldown * 60);
  await redis.del(`muted:${userId}`);

  return c.json<TriggerResponse>(
    {
      status: 'success',
    },
    200
  );
});
