// Userbot (MTProto) — Telegram foydalanuvchi akkaunti orqali guruh xabarlarini o'qish.
// Nima uchun kerak: Bot API qoidasiga ko'ra botlar guruhdagi BOSHQA BOTLAR yozgan xabarlarni ko'rmaydi.
// Agar lidlar guruhga boshqa bot (sayt formasi, Facebook/Instagram lead bot va h.k.) orqali tushsa,
// shu akkaunt guruhda a'zo bo'lib, xabarlarni o'qiydi va Lidex'ga uzatadi.

import { config } from '../config.js';
import { logger } from '../logger.js';
import { allGroups } from '../services/groups.js';
import { ingestLead } from '../services/leads.js';

type Client = import('telegram').TelegramClient;
let client: Client | null = null;

export async function startUserbot(): Promise<void> {
  if (!config.USERBOT_ENABLED) return;
  if (!config.TG_API_ID || !config.TG_API_HASH || !config.TG_USERBOT_SESSION) {
    logger.warn('USERBOT_ENABLED=true, lekin TG_API_ID / TG_API_HASH / TG_USERBOT_SESSION berilmagan. `npm run userbot:login` ni bajaring');
    return;
  }
  const { TelegramClient } = await import('telegram');
  const { StringSession } = await import('telegram/sessions/index.js');
  const { NewMessage } = await import('telegram/events/index.js');
  const { getPeerId } = await import('telegram/Utils.js');

  client = new TelegramClient(new StringSession(config.TG_USERBOT_SESSION), config.TG_API_ID, config.TG_API_HASH, {
    connectionRetries: 10,
    autoReconnect: true,
  });
  client.setLogLevel('error' as never);
  await client.connect();
  const me = await client.getMe();
  logger.info({ user: (me as { username?: string }).username ?? (me as { id?: unknown }).id }, 'Userbot ulandi');

  client.addEventHandler(async (event) => {
    try {
      const msg = event.message;
      const text = (msg.message ?? '').trim();
      if (!text || text.startsWith('/')) return;
      const chatId = Number(getPeerId(msg.peerId));
      const group = (await allGroups()).find((g) => g.chatId === chatId);
      if (!group || group.status !== 'active') return;
      if (group.settings.ingestVia !== 'userbot') return;
      await ingestLead({ group, source: 'userbot', text, chatId, messageId: msg.id });
    } catch (err) {
      logger.error({ err }, 'Userbot: xabarni qayta ishlashda xato');
    }
  }, new NewMessage({}));
}

export async function stopUserbot() {
  if (client) await client.disconnect().catch(() => undefined);
}
