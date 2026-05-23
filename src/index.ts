import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { forms } from './routes/forms';
import { menus } from './routes/menus';
import { settings } from './routes/settings';
import { triggers } from './routes/triggers';

const app = new Hono();
const internal = new Hono();

internal.route('/menus', menus);
internal.route('/forms', forms);
internal.route('/settings', settings);
internal.route('/triggers', triggers);

app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
