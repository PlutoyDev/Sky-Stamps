import 'dotenv/config';
import authServerInit from './auth';
import SkyTimestamp from './timestamp';

const timestamp = new SkyTimestamp();

authServerInit(timestamp.addWebhook);
