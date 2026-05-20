import { Hono } from 'hono';
import { redis } from '@devvit/redis';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';

type MuteFormValues = {
    username: string;
    userId: string;
    muteHours: number;
}

export const forms = new Hono();

const normalizeValues = (values: MuteFormValues) => ({
    username: String(values.username),
    userId: String(values.userId),
    muteHours: Number(values.muteHours),
})

forms.post('/mute-user-submit', async (c) => {
    const values = await c.req.json<MuteFormValues>();
    const normalized = normalizeValues(values);
    
    if (!normalized.muteHours) {
        return c.json<UiResponse>(
            {
                showToast: 'You must specify the duration to mute the user for.',
            },
            200
        );
    }

    const muteUntil = Date.now() + (normalized.muteHours * 60 * 60 * 1000);
    await redis.set(`muted:${context.subredditName}:${normalized.userId}`, 'true');
    await redis.set(`lastpost:${context.subredditName}:${normalized.userId}`, muteUntil.toString());

    return c.json<UiResponse>(
        {
            showToast: `u/${normalized.username} has been muted for ${normalized.muteHours} hours.`
        },
        200
    );
});