import { Hono } from 'hono';
import { reddit } from '@devvit/reddit';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { FormField } from '@devvit/shared-types/shared/form.js';

export const menus = new Hono();

const buildResetCooldownUnmuteFields = (username: string): FormField[] => [
    {
        name: 'username',
        label: 'Username of the user to reset cooldown for',
        type: 'string',
        required: true,
        defaultValue: username,
    }
]

const buildResetCooldownUnmuteForm = (title: string, username: string) => ({
    fields: buildResetCooldownUnmuteFields(username),
    title,
    acceptLabel: 'Reset',
    cancelLabel: 'Cancel',
})

menus.post('/reset-cooldown-unmute', async (c) => {
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
                name: 'resetCooldownUnmute',
                form: buildResetCooldownUnmuteForm('Reset cooldown/unmute user', username),
            },
        },
        200
    );
});

const buildMuteFields = (username: string): FormField[] => [
    {
        name: 'username',
        label: 'Username of the user to mute',
        type: 'string',
        required: true,
        defaultValue: username,
    },
    {
        name: 'muteHours',
        label: 'Number of hours to mute the user for',
        type: 'number',
        helpText: 'Temporarily stop/mute the user from posting for a set amount of time.',
        required: true,
    },
];

const buildMuteForm = (title: string, username: string) => ({
    fields: buildMuteFields(username),
    title,
    acceptLabel: 'Mute',
    cancelLabel: 'Cancel',
})

menus.post('/mute-user', async (c) => {
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
                name: 'muteUser',
                form: buildMuteForm('Temporarily mute user', username),
            },
        },
        200
    );
});