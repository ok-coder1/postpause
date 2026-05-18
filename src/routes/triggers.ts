import { Hono } from 'hono';
import { reddit } from '@devvit/reddit';
import { redis } from '@devvit/redis';
import { settings } from '@devvit/web/server';
import type {
  OnAppInstallRequest,
  OnPostSubmitRequest,
  TriggerResponse
} from '@devvit/web/shared';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  const input = await c.req.json<OnAppInstallRequest>();
  const subredditName = input.subreddit?.name;

  console.log('App installed to subreddit: r/' + subredditName);

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
  const cooldownMinutes = (await settings.get('cooldownMinutes') as number) ?? 60;

  if (!userId || !username || !postId) {
    return c.json<TriggerResponse>(
      {
        status: 'success',
      },
      200
    );
  }

  const lastPostTime = await redis.get(`lastpost:${userId}`);

  if (lastPostTime) {
    const minutesSince = (Date.now() - parseInt(lastPostTime)) / (1000 * 60);

    if (minutesSince < cooldownMinutes) {
      const minutesLeft = (cooldownMinutes - minutesSince).toFixed(1);

      await reddit.remove(`t3_${postId}`, false);
      await reddit.sendPrivateMessage({
        to: username,
        subject: 'PostPause - Cooldown',
        text: `Your post in **r/${subredditName}** was removed. Please wait for **${minutesLeft} minutes** until you can post again.`
      })

      return c.json<TriggerResponse>(
        {
          status: 'success',
        },
        200
      );
    }
  }

  await redis.set(`lastpost:${userId}`, Date.now().toString());

  return c.json<TriggerResponse>(
    {
      status: 'success',
    },
    200
  );
})