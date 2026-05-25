import { Hono } from 'hono';
import { reddit } from '@devvit/reddit';
import { redis } from '@devvit/redis';
import { context, settings } from '@devvit/web/server';
import type { UiResponse } from '@devvit/web/shared';

type ResetCooldownUnmuteFormValues = {
    username: string;
}

type MuteFormValues = {
    username: string;
    muteHours: number;
}

export const forms = new Hono();

const normalizeResetCooldownUnmuteValues = (values: ResetCooldownUnmuteFormValues) => ({
    username: String(values.username),
});

forms.post('/reset-cooldown-unmute-submit', async (c) => {
    const values = await c.req.json<ResetCooldownUnmuteFormValues>();
    const normalized = normalizeResetCooldownUnmuteValues(values);
    const subredditName = context.subredditName;
    const username = normalized.username;
    const user = await reddit.getUserByUsername(username);
    const userId = user?.id;

    if (!username || !user || !userId) {
        return c.json<UiResponse>(
            {
                showToast: 'Please specify a user.',
            },
            200
        );
    }

    await redis.del(`lastpost:${subredditName}:${userId}`);
    const isMuted = await redis.get(`muted:${subredditName}:${userId}`);
    if (isMuted == 'true') {
        await redis.del(`muted:${subredditName}:${userId}`);
        return c.json<UiResponse>(
            {
                showToast: `u/${username} has been unmuted. They can now post immediately.`,
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

const normalizeMuteValues = (values: MuteFormValues) => ({
    username: String(values.username),
    muteHours: values.muteHours,
});

forms.post('/mute-user-submit', async (c) => {
    const values = await c.req.json<MuteFormValues>();
    const normalized = normalizeMuteValues(values);
    const subredditName = context.subredditName;
    const username = normalized.username;
    const user = await reddit.getUserByUsername(username);
    const userId = user?.id;
    const muteHours = normalized.muteHours;
    const post = await reddit.getPostById(context.postId!);
    const postFlair = post.flair?.text;
    const flairsCooldown = await settings.get<string>('flairsCooldown');
    let isFlairInFlairsCooldown = false;
    let isMod;

    if (flairsCooldown) {
        const linesFlairs = flairsCooldown.split("\n");
        for (const line of linesFlairs) {
            const [flair, cooldownOfFlair] = line.split(":").map(part => part.trim());
            if (flair == postFlair) {
                isFlairInFlairsCooldown = true;
                break;
            }
        }
    }

    if (context.username == username) {
        return c.json<UiResponse>(
            {
                showToast: 'You cannot mute yourself.',
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
                showToast: 'You cannot mute a moderator.',
            },
            200
        );
    }

    if (!normalized.muteHours || normalized.muteHours <= 0) {
        return c.json<UiResponse>(
            {
                showToast: 'You must specify the duration to mute the user for.',
            },
            200
        );
    }
    
    const muteUntil = Date.now() + (normalized.muteHours * 60 * 60 * 1000);
    await redis.set(`muted:${userId}`, 'true');
    await redis.expire(`muted:${userId}`, normalized.muteHours * 60 * 60);
    if (isFlairInFlairsCooldown) {
        await redis.set(`lastpost:${postFlair}:${userId}`, muteUntil.toString());
        await redis.expire(`lastpost:${postFlair}:${userId}`, normalized.muteHours * 60 * 60);
    } else {
        await redis.set(`lastpost:${userId}`, muteUntil.toString());
        await redis.expire(`lastpost:${userId}`, normalized.muteHours * 60 * 60);
    }

    return c.json<UiResponse>(
        {
            showToast: `u/${username} has been muted for ${muteHours} hours.`
        },
        200
    );
});