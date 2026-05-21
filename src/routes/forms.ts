import { Hono } from 'hono';
import { reddit } from '@devvit/reddit';
import { redis } from '@devvit/redis';
import { context } from '@devvit/web/server';
import type { UiResponse } from '@devvit/web/shared';

type ResetCooldownUnmuteFormValues = {
    username: string;
    userId: string;
}

type MuteFormValues = {
    username: string;
    userId: string;
    muteHours: number;
}

export const forms = new Hono();

const normalizeResetCooldownUnmuteValues = (values: ResetCooldownUnmuteFormValues) => ({
    username: String(values.username),
    userId: String(values.userId),
});

forms.post('/reset-cooldown-unmute-submit', async (c) => {
    const values = await c.req.json<ResetCooldownUnmuteFormValues>();
    const normalized = normalizeResetCooldownUnmuteValues(values);
    const subredditName = context.subredditName;
    const userId = normalized.userId;
    const username = normalized.username;

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
    userId: String(values.userId),
    muteHours: values.muteHours,
});

forms.post('/mute-user-submit', async (c) => {
    const values = await c.req.json<MuteFormValues>();
    const normalized = normalizeMuteValues(values);
    const subredditName = context.subredditName;
    const userId = normalized.userId;
    const username = normalized.username;
    const muteHours = normalized.muteHours
    let isMod;

    if (context.username == username) {
        return c.json<UiResponse>(
            {
                showToast: 'You cannot mute yourself.',
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
    await redis.set(`lastpost:${userId}`, muteUntil.toString());

    return c.json<UiResponse>(
        {
            showToast: `u/${username} has been muted for ${muteHours} hours.`
        },
        200
    );
});