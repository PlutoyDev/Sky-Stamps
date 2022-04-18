import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { CronJob } from 'cron';
import {
  add,
  differenceInDays,
  getUnixTime,
  isAfter,
  isBefore,
  isFuture,
  isPast,
  isToday,
  startOfDay,
  sub,
} from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';
import retry from './utils/retry';

const formatFullWithRel = (t: Date | number) => {
  const utc = zonedTimeToUtc(t, 'America/Los_Angeles');
  const unix = getUnixTime(utc);
  return `<t:${unix}> (<t:${unix}:R>)`;
};

const formatTwithRel = (t: Date | number) => {
  const utc = zonedTimeToUtc(t, 'America/Los_Angeles');
  const unix = getUnixTime(utc);
  return `<t:${unix}:t> (<t:${unix}:R>)`;
};

const datePrint = (formatter: (d: Date) => string) => {
  return (
    strs: TemplateStringsArray,
    ...values: (Date | number | string)[]
  ) => {
    return strs.reduce((acc, str, idx) => {
      acc += str;
      const val = values[idx];
      if (!val) return acc;
      if (val instanceof Date) {
        return acc + formatter(val);
      } else {
        return acc + val;
      }
    }, '');
  };
};

const datePrintFwithR = datePrint(formatFullWithRel);
const datePrintTwithR = datePrint(formatTwithRel);

export default class SkyTimestamp {
  axiosInstance = axios.create({
    baseURL: 'https://discord.com/api/webhooks/',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  webhooks: { id: string; token: string; messageId?: string }[] = [];

  repeat = [
    {
      title:
        ':s06Sanctuary: **__Current Timestamps for the Sanctuary Islands Geyser Wax__** (by @Yash🌈)',
      offset: 5,
      interval: 120,
      duration: 10,
    },
    {
      title:
        ':s03Belonging: **__Current Timestamps for Forest Grandma Dinner Wax__** (by @Elysian)',
      offset: 35,
      interval: 120,
      duration: 10,
    },
  ] as const;

  cache: string = '';
  reptCache: {
    str: string;
    dates: Date[];
    duration: number;
  }[] = [];

  dailyCron: CronJob;
  freqCron: CronJob;

  //Traveling Spirit
  static tsPivotDate = new Date(2022, 0, 10);
  static tsPivotNum = 52;
  constructor() {
    this.readWebhooks();
    this.dailyCron = new CronJob(
      '0 0 */1 * * *',
      this.dailyTask.bind(this),
      null,
      true,
      undefined,
      null,
      true
    );

    this.freqCron = new CronJob(
      '5 5/5 * * * *',
      this.freqTask.bind(this),
      null,
      true,
      undefined,
      null,
      true
    );

    this.axiosInstance.interceptors.response.use(undefined, retry);
  }

  dailyTask() {
    const { tsPivotDate, tsPivotNum } = SkyTimestamp;

    const now = new Date();
    const today = startOfDay(now);
    const dailyReset = add(today, { days: 1 });
    const dayToEden = 7 - new Date().getDay();
    const edenReset = add(today, { days: dayToEden });
    const dayToTSpiritD = 14 - (differenceInDays(new Date(), tsPivotDate) % 14);
    const tSpiritD = add(today, { days: dayToTSpiritD, minutes: -1 });
    const tSpiritA = sub(tSpiritD, { days: 4, minutes: -1 });
    const tSpiritN =
      1 + Math.floor(differenceInDays(tSpiritD, tsPivotDate) / 14) + tsPivotNum;

    this.cache = datePrintFwithR`
Daily Reset: ${dailyReset}
Eden Reset: ${edenReset}

__Traveling Spirit ${tSpiritN}___
Arrival: ${tSpiritA}
Depature: ${tSpiritD}
`;

    this.reptCache = this.repeat.map(
      ({ title, offset, interval, duration }) => {
        const count = Math.floor(1440 / interval) + 1;
        const start = add(today, { minutes: offset });

        const dates = new Array(count)
          .fill(0)
          .map((_, i) => add(start, { minutes: interval * i }));
        const str =
          `${title}\n` +
          dates
            .filter(isToday)
            .map(
              t =>
                `<t:${getUnixTime(zonedTimeToUtc(t, 'America/Los_Angeles'))}:t>`
            )
            .join('➡️');

        return { str, dates, duration };
      }
    );
  }

  freqTask() {
    console.log('FREQ');
    const repeatStr = this.reptCache
      .map(({ str, dates, duration }) => {
        const nextStart = dates.find(isFuture) as Date;
        const nextEnd = dates
          .map(t => add(t, { minutes: duration }))
          .find(isFuture) as Date;
        const isOngoing = isAfter(nextStart, nextEnd);

        return isOngoing
          ? datePrintTwithR`${str}\nOngoing until: ${nextEnd}\nUpcomming: ${nextStart}`
          : datePrintTwithR`${str}\nUpcomming: ${nextStart}`;
      })
      .join(`\n\n`);

    this.sendMessages(
      datePrintTwithR`⏰ **__Main Game Timestamps__** (Last Updated: ${new Date()})\n${
        this.cache
      }\n${repeatStr}`
    );
  }

  async sendMessages(content: string) {
    const len = this.webhooks.length;
    for (let i = 0; i < len; i++) {
      const { id, token, messageId } = this.webhooks[i];
      this.sendMessage(content, i, id, token, messageId);
    }
  }

  async sendMessage(
    content: string,
    idx: number,
    id: string,
    token: string,
    messageId?: string
  ) {
    if (!messageId) {
      this.axiosInstance
        .post(
          `/${id}/${token}`,
          {
            content,
          },
          {
            params: {
              wait: true,
            },
          }
        )
        .then(res => {
          this.webhooks[idx].messageId = res.data.id;
          this.writeWebhooks();
        })
        .catch(err => {
          if (axios.isAxiosError(err)) {
            if (err.response?.status === 404) {
              console.log(`Webhook ${id} not found`);
              this.webhooks.splice(idx, 1);
            }
          } else {
            console.error(err);
          }
        });
    } else {
      await this.axiosInstance
        .patch(`/${id}/${token}/messages/${messageId}`, {
          content,
        })
        .catch(err => {
          if (axios.isAxiosError(err)) {
            if (err.response?.status === 404) {
              console.log('Missing message');
              this.webhooks[idx].messageId = undefined;
              this.sendMessage(content, idx, id, token);
            }
          } else {
            console.error(err);
          }
        });
    }
  }

  addWebhook = (id: string, token: string) => {
    console.log(`Adding webhook ${id}`);
    this.webhooks.push({ id, token });
    this.writeWebhooks();
    this.freqTask();
  };

  writeWebhooks = () => {
    return fs.promises.writeFile(
      path.resolve('./data/webhooks.json'),
      JSON.stringify(this.webhooks, null, 2)
    );
  };

  readWebhooks = () => {
    const webhooks = fs.readFileSync(
      path.resolve('./data/webhooks.json'),
      'utf8'
    );
    this.webhooks = JSON.parse(webhooks);
  };
}
