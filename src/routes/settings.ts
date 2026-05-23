import { Hono } from 'hono';
import type { SettingsValidationRequest, SettingsValidationResponse } from '@devvit/web/shared';

export const settings = new Hono();

settings.post('/validate-cooldown', async (c) => {
    const { value } = await c.req.json<SettingsValidationRequest<number>>();

    if (!value || value < 0) {
        return c.json<SettingsValidationResponse>(
            {
                success: false,
                error: 'Cooldown must be a positive number.',
            },
        );
    }

    return c.json<SettingsValidationResponse>(
        {
            success: true 
        },
        200
    );
});

settings.post('/validate-removal-message', async (c) => {
    const { value } = await c.req.json<SettingsValidationRequest<string>>();

    if (!value) {
        return c.json<SettingsValidationResponse>(
            {
                success: false,
                error: 'Removal message cannot be empty.',
            },
        );
    } else if (!value.includes('timeLeft')) {
        return c.json<SettingsValidationResponse>(
            {
                success: false,
                error: 'Removal message must include the placeholder "timeLeft".',
            }
        );
    } else if (!value.includes('subredditName')) {
        return c.json<SettingsValidationResponse>(
            {
                success: false,
                error: 'Removal message must include the placeholder "r/subredditName".',
            }
        );
    }

    return c.json<SettingsValidationResponse>(
        {
            success: true 
        },
        200
    );
});

settings.post('/validate-flairs', async (c) => {
    const { value } = await c.req.json<SettingsValidationRequest<string>>();

    if (!value) {
        return c.json<SettingsValidationResponse>(
            {
                success: true,
            },
            200
        );
    }

    const lines = value.split("\n");
    const flairsFound = new Set<string>();

    for (const line of lines) {
        const [flair, cooldown] = line.split(":").map(part => part.trim());

        if (!flair || !cooldown) {
            return c.json<SettingsValidationResponse>(
                {
                    success: false,
                    error: `Invalid format in line: "${line}". Each line must be in the format "flair: cooldown".`,
                },
            );
        }

        if (flairsFound.has(flair)) {
            return c.json<SettingsValidationResponse>(
                {
                    success: false,
                    error: `Duplicate flair found: "${flair}".`,
                },
            );
        }

        flairsFound.add(flair);
    }

    return c.json<SettingsValidationResponse>(
        {
            success: true 
        },
        200
    );
});