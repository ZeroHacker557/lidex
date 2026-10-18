// Userbot sessiyasini yaratish: `npm run userbot:login`
// 1) https://my.telegram.org -> API development tools: api_id va api_hash oling
// 2) .env ga TG_API_ID va TG_API_HASH yozing
// 3) Ushbu skriptni ishga tushiring, telefon va kodni kiriting
// 4) Chiqqan TG_USERBOT_SESSION qatorini .env ga qo'shing

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { config } from '../config.js';

const rl = createInterface({ input, output });

async function main() {
  const apiId = config.TG_API_ID ?? Number(await rl.question('TG_API_ID: '));
  const apiHash = config.TG_API_HASH ?? (await rl.question('TG_API_HASH: '));
  const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 5 });
  await client.start({
    phoneNumber: () => rl.question('Telefon raqam (+998...): '),
    password: () => rl.question('2FA parol (bo\'lmasa Enter): '),
    phoneCode: () => rl.question('Telegramdan kelgan kod: '),
    onError: (err) => console.error('Xato:', err.message),
  });
  const session = client.session.save() as unknown as string;
  console.log('\n✅ Muvaffaqiyatli! .env fayliga quyidagilarni qo\'shing:\n');
  console.log('USERBOT_ENABLED=true');
  console.log(`TG_USERBOT_SESSION=${session}\n`);
  console.log('⚠️  Bu sessiya akkauntingizga to\'liq kirish huquqini beradi — hech kimga bermang.');
  await client.disconnect();
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
