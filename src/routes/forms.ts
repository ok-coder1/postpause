import { Hono } from 'hono';
import { reddit } from '@devvit/reddit';
import { redis } from '@devvit/redis';
import { context, settings } from '@devvit/web/server';
import type { UiResponse } from '@devvit/web/shared';

type ResetCooldownUntimeoutFormValues = {
    postId: string;
    username: string;
}

type TimeoutFormValues = {
    postId: string;
    username: string;
    timeoutHours: number;
}

export const forms = new Hono();

const normalizeResetCooldownUntimeoutValues = (values: ResetCooldownUntimeoutFormValues) => ({
    postId: String(values.postId),
    username: String(values.username),
});

forms.post('/reset-cooldown-untimeout-submit', async (c) => {
    const values = await c.req.json<ResetCooldownUntimeoutFormValues>();
    const normalized = normalizeResetCooldownUntimeoutValues(values);
    const username = normalized.username;
    const user = await reddit.getUserByUsername(username);
    const userId = user?.id;
    const post = await reddit.getPostById(`t3_${normalized.postId.replace('t3_', '')}`);
    const postFlair = post.flair?.text;
    const flairsCooldown = await settings.get<string>('flairsCooldown');
    let isFlairInFlairsCooldown = false;

    if (flairsCooldown) {
        const linesFlairs = flairsCooldown.split("\n");
        for (const line of linesFlairs) {
            const [flair] = line.split(":").map(part => part.trim());
            if (flair == postFlair) {
                isFlairInFlairsCooldown = true;
                break;
            }
        }
    }

    if (!username || !user || !userId) {
        return c.json<UiResponse>(
            {
                showToast: 'Please specify a user.',
            },
            200
        );
    }

    await redis.del(`lastpost:${userId}`);
    if (isFlairInFlairsCooldown) {
        await redis.del(`lastpost:${postFlair}:${userId}`);
    }
    const isTimedOut = await redis.get(`timedout:${userId}`);
    if (isTimedOut == 'true') {
        await redis.del(`timedout:${userId}`);
        return c.json<UiResponse>(
            {
                showToast: `u/${username} has been untimedout. They can now post immediately.`,
            },
            200
        );
    } else {
        return c.json<UiResponse>(
            {
                showToast: `The cooldown for u/${username} has been reset. They can now post immediately.`,
            },
            200
        );
    }
});

const normalizeTimeoutValues = (values: TimeoutFormValues) => ({
    postId: String(values.postId),
    username: String(values.username),
    timeoutHours: values.timeoutHours,
});

forms.post('/timeout-user-submit', async (c) => {
    const values = await c.req.json<TimeoutFormValues>();
    const normalized = normalizeTimeoutValues(values);
    const subredditName = context.subredditName;
    const username = normalized.username;
    const user = await reddit.getUserByUsername(username);
    const userId = user?.id;
    const timeoutHours = normalized.timeoutHours;
    const post = await reddit.getPostById(`t3_${normalized.postId.replace('t3_', '')}`);
    const postFlair = post.flair?.text;
    const flairsCooldown = await settings.get<string>('flairsCooldown');
    let isFlairInFlairsCooldown = false;
    let isMod;

    if (flairsCooldown) {
        const linesFlairs = flairsCooldown.split("\n");
        for (const line of linesFlairs) {
            const [flair] = line.split(":").map(part => part.trim());
            if (flair == postFlair) {
                isFlairInFlairsCooldown = true;
                break;
            }
        }
    }

    if (context.username == username) {
        return c.json<UiResponse>(
            {
                showToast: 'You cannot timeout yourself.',
            },
            200
        );
    }

    if (!username || !user || !userId) {
        return c.json<UiResponse>(
            {
                showToast: 'Please specify a user.',
            },
            200
        );
    }

    try {
        isMod = (await reddit.getModerators({ subredditName, username }).all()).length > 0;
    } catch (error) {
        console.error('Error checking if user is a moderator: ', error);
    }

    if (isMod) {
        return c.json<UiResponse>(
            {
                showToast: 'You cannot timeout a moderator.',
            },
            200
        );
    }

    if (!normalized.timeoutHours || normalized.timeoutHours <= 0) {
        return c.json<UiResponse>(
            {
                showToast: 'You must specify the duration to timeout the user for.',
            },
            200
        );
    }

    const muteUntil = Date.now() + (normalized.timeoutHours * 60 * 60 * 1000);
    await redis.set(`timedout:${userId}`, 'true');
    await redis.expire(`timedout:${userId}`, normalized.timeoutHours * 60 * 60);
    if (isFlairInFlairsCooldown) {
        await redis.set(`lastpost:${userId}`, muteUntil.toString());
        await redis.expire(`lastpost:${userId}`, normalized.timeoutHours * 60 * 60);
        await redis.set(`lastpost:${postFlair}:${userId}`, muteUntil.toString());
        await redis.expire(`lastpost:${postFlair}:${userId}`, normalized.timeoutHours * 60 * 60);
    } else {
        await redis.set(`lastpost:${userId}`, muteUntil.toString());
        await redis.expire(`lastpost:${userId}`, normalized.timeoutHours * 60 * 60);
    }

    return c.json<UiResponse>(
        {
            showToast: `u/${username} has been timed out for ${timeoutHours} hours.`
        },
        200
    );
});