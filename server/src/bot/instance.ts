import { Bot } from 'grammy';
import { config } from '../config.js';

/** BOT_TOKEN bo'lmasa bot o'chirilgan holda ishlaydi (faqat panel va API) */
export const bot: Bot | null = config.BOT_TOKEN ? new Bot(config.BOT_TOKEN) : null;

let username: string | null = null;
export const botInfo = {
  get username() {
    return username;
  },
  set(u: string) {
    username = u;
  },
};
