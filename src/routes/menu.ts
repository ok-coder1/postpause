import { Hono } from 'hono';
import { reddit } from '@devvit/reddit';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { FormField } from '@devvit/shared-types/shared/form.js';

export const menus = new Hono();

const buildMuteFields = (username: string, userId: string): FormField[] => [
  {
    name: 'muteLabel',
    label: 'Temporarily stops/mutes the user from posting for a set amount of time',
    type: 'paragraph',
    disabled: true,
    defaultValue: 'Temporarily stops/mutes the user from posting for a set amount of time and PM the user.',
  },
  {
    name: 'username',
    label: 'Username of the user to mute',
    type: 'string',
    disabled: true,
    defaultValue: username,
  },
  {
    name: 'userId',
    label: 'User ID of the user to mute',
    type: 'string',
    disabled: true,
    defaultValue: userId,
  },
  {
    name: 'muteHours',
    label: 'Number of hours to mute the user for',
    type: 'number',
  },
];

const buildMuteForm = (title: string, username: string, userId: string) => ({
    fields: buildMuteFields(username, userId),
    title,
    acceptLabel: 'Mute',
    cancelLabel: 'Cancel',
})

menus.post('/mute-user', async (c) => {
    const request = await c.req.json<MenuItemRequest>();
    let username;
    let userId;
    if (request.location == "post") {
        const targetId = request.targetId.replace('t3_', '');
        const post = await reddit.getPostById(`t3_${targetId}`);
        username = post.authorName;
        userId = post.authorId;
    } else if (request.location == "comment") {
        const targetId = request.targetId.replace('t1_', '');
        const comment = await reddit.getCommentById(`t1_${targetId}`);
        username = comment.authorName;
        userId = comment.authorId;
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
                form: buildMuteForm('Temporarily mute user', username,  `${userId}`),
            },
        },
        200
    );
});