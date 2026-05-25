import { Hono } from 'hono';
import { reddit } from '@devvit/reddit';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { FormField } from '@devvit/shared-types/shared/form.js';

export const menus = new Hono();

const buildResetCooldownUntimeoutFields = (username: string): FormField[] => [
    {
        name: 'username',
        label: 'Username of the user to reset cooldown for',
        type: 'string',
        required: true,
        defaultValue: username,
    }
]

const buildResetCooldownUntimeoutForm = (title: string, username: string) => ({
    fields: buildResetCooldownUntimeoutFields(username),
    title,
    acceptLabel: 'Reset',
    cancelLabel: 'Cancel',
})

menus.post('/reset-cooldown-untimeout', async (c) => {
    const request = await c.req.json<MenuItemRequest>();
    let username;
    if (request.location == "post") {
        const targetId = request.targetId.replace('t3_', '');
        const post = await reddit.getPostById(`t3_${targetId}`);
        username = post.authorName;
    } else if (request.location == "comment") {
        const targetId = request.targetId.replace('t1_', '');
        const comment = await reddit.getCommentById(`t1_${targetId}`);
        username = comment.authorName;
    } else {
        return c.json<UiResponse>(
            {
                showToast: 'This menu item can only be used on posts or comments.',
            },
            200
        );
    }
    return c.json<UiResponse>(
        {
            showForm: {
                name: 'resetCooldownUntimeout',
                form: buildResetCooldownUntimeoutForm('Reset cooldown/untimeout user', username),
            },
        },
        200
    );
});

const buildTimeoutFields = (username: string): FormField[] => [
    {
        name: 'username',
        label: 'Username of the user to timeout',
        type: 'string',
        required: true,
        defaultValue: username,
    },
    {
        name: 'timeoutHours',
        label: 'Number of hours to timeout the user for',
        type: 'number',
        helpText: 'Temporarily stop/timeout the user from posting for a set amount of time.',
        required: true,
    },
];

const buildTimeoutForm = (title: string, username: string) => ({
    fields: buildTimeoutFields(username),
    title,
    acceptLabel: 'Timeout',
    cancelLabel: 'Cancel',
})

menus.post('/timeout-user', async (c) => {
    const request = await c.req.json<MenuItemRequest>();
    let username;
    if (request.location == "post") {
        const targetId = request.targetId.replace('t3_', '');
        const post = await reddit.getPostById(`t3_${targetId}`);
        username = post.authorName;
    } else if (request.location == "comment") {
        const targetId = request.targetId.replace('t1_', '');
        const comment = await reddit.getCommentById(`t1_${targetId}`);
        username = comment.authorName;
    } else {
        return c.json<UiResponse>(
            {
                showToast: 'This menu item can only be used on posts or comments.',
            },
            200
        );
    }
    return c.json<UiResponse>(
        {
            showForm: {
                name: 'timeoutUser',
                form: buildTimeoutForm('Temporarily timeout user', username),
            },
        },
        200
    );
});