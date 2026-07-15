# Deploy MineKeep

## Before deployment

1. Create a MongoDB Atlas database and allow connections from your hosting service.
2. Copy `.env.example` values into the host's environment settings.
3. Set `MONGODB_URI` to the Atlas connection string.
4. Keep `NODE_ENV=production` and `SEED_DATABASE=false`.

If this is a brand-new empty database, set `SEED_DATABASE=true` for the first deployment only. This creates the initial accounts. Immediately change their passwords, then set it back to `false` and redeploy.

## Render

1. Push this folder to a Git repository.
2. In Render, select **New > Blueprint** and choose the repository.
3. Enter the `MONGODB_URI` secret when requested.
4. Deploy. Render uses `render.yaml`, runs `npm ci`, and starts the app with `npm start`.

The health check is available at `/health`.

## Required commands on other Node hosts

- Build/install: `npm ci`
- Start: `npm start`
- Health check: `/health`
