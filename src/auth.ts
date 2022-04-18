import express from 'express';
import axios from 'axios';

const { DISCORD_CLIENT_SECRET, DISCORD_CLIENT_ID, DISCORD_OAUTH_REDIRECT_URI } =
  process.env;

if (
  !DISCORD_CLIENT_ID ||
  !DISCORD_CLIENT_SECRET ||
  !DISCORD_OAUTH_REDIRECT_URI
) {
  throw new Error(
    'DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_OAUTH_REDIRECT_URI must be set'
  );
}

const authServerInit = (
  webhookCallback: (id: string, token: string) => void
) => {
  const app = express();

  app.use(express.json());

  app.get('/', (req, res) => {
    res.redirect('/discord/login');
  });

  app.get('/discord/login', (req, res) => {
    const state = Math.random().toString(36).substring(2, 15);
    const url = new URL('/api/oauth2/authorize', 'https://discord.com');

    const param = {
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: DISCORD_OAUTH_REDIRECT_URI,
      response_type: 'code',
      scope: 'webhook.incoming',
      state,
    };

    const searchParams = new URLSearchParams(param);

    res
      .cookie('state', state)
      .redirect(url.toString() + '?' + searchParams.toString());
  });

  app.get('/discord/callback', async (req, res) => {
    const code = req.query.code;

    if (!code || typeof code !== 'string') {
      res.status(400).send('Missing code');
      return;
    }

    const tokenData = {
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      redirect_uri: DISCORD_OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
      code,
    };

    const tokenDataStr = new URLSearchParams(tokenData);

    try {
      const tokenRes = (
        await axios.post('https://discord.com/api/oauth2/token', tokenDataStr)
      ).data;
      const { id, token } = tokenRes.webhook;

      if (!id || !token) {
        res.status(400).send('Missing id or token');
        return;
      }

      webhookCallback(id, token);

      res.send(
        'Success\nGo ahead and check the channel that you have selected'
      );
    } catch (e) {
      console.error(e);
      res.status(500).send('Error');
    }
  });

  app.listen(2712, () => {
    console.log('Auth server listening on port 2712');
  });
};

export default authServerInit;
