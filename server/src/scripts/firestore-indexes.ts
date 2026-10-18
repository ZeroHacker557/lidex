// Firestore kompozit indekslarini yaratish: `npm run firestore:indexes`
// firebase CLI kerak emas — service account orqali Firestore Admin API ishlatiladi.
// Mavjud indekslar o'tkazib yuboriladi; yangilari fonda quriladi (2–10 daqiqa).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isAbsolute, resolve } from 'node:path';
import firestorePkg from '@google-cloud/firestore';
import { config } from '../config.js';
import { ROOT_DIR } from '../paths.js';

const { v1 } = firestorePkg as unknown as typeof import('@google-cloud/firestore');

interface IndexField {
  fieldPath: string;
  order?: 'ASCENDING' | 'DESCENDING';
  arrayConfig?: 'CONTAINS';
}
interface IndexDef {
  collectionGroup: string;
  queryScope: 'COLLECTION';
  fields: IndexField[];
}

function credentials(): { client_email: string; private_key: string; project_id: string } {
  if (config.FIREBASE_SERVICE_ACCOUNT) {
    const raw = config.FIREBASE_SERVICE_ACCOUNT.trim();
    return JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  }
  const rel = config.FIREBASE_SERVICE_ACCOUNT_PATH ?? 'firebase-service-account.json';
  const path = isAbsolute(rel) ? rel : resolve(ROOT_DIR, rel);
  return JSON.parse(readFileSync(path, 'utf8'));
}

const sig = (fields: IndexField[]) => fields.map((f) => `${f.fieldPath}:${f.order ?? f.arrayConfig}`).join(',');

async function main() {
  const creds = credentials();
  const projectId = config.FIREBASE_PROJECT_ID ?? creds.project_id;
  const dbId = config.FIRESTORE_DATABASE_ID ?? '(default)';
  const client = new v1.FirestoreAdminClient({ credentials: { client_email: creds.client_email, private_key: creds.private_key }, projectId });
  const wanted = (JSON.parse(readFileSync(join(ROOT_DIR, 'firestore.indexes.json'), 'utf8')) as { indexes: IndexDef[] }).indexes;

  const [existing] = await client.listIndexes({ parent: `projects/${projectId}/databases/${dbId}/collectionGroups/-` });
  const have = new Set(
    existing.map((ix) => {
      const cg = ix.name?.split('/collectionGroups/')[1]?.split('/')[0];
      const fields = (ix.fields ?? [])
        .filter((f) => f.fieldPath !== '__name__')
        .map((f) => ({ fieldPath: f.fieldPath!, order: (f.order ?? undefined) as IndexField['order'], arrayConfig: (f.arrayConfig ?? undefined) as IndexField['arrayConfig'] }));
      return `${cg}|${sig(fields)}`;
    }),
  );

  let created = 0;
  let skipped = 0;
  for (const ix of wanted) {
    const cg = config.FIRESTORE_PREFIX + ix.collectionGroup;
    if (have.has(`${cg}|${sig(ix.fields)}`)) {
      skipped++;
      continue;
    }
    try {
      await client.createIndex({
        parent: `projects/${projectId}/databases/${dbId}/collectionGroups/${cg}`,
        index: { queryScope: 'COLLECTION', fields: ix.fields },
      });
      created++;
      console.log(`  + ${cg}: ${sig(ix.fields)}`);
    } catch (err) {
      const e = err as { code?: number; message?: string };
      if (e.code === 6) skipped++;
      else throw err;
    }
  }
  console.log(`\n✅ Indekslar: ${created} ta yaratilmoqda, ${skipped} ta allaqachon bor (loyiha: ${projectId})`);
  if (created) console.log("ℹ️  Yangi indekslar Firebase konsolida 'Building' holatidan 'Enabled' ga o'tguncha 2–10 daqiqa kuting.");
  await client.close();
}

main().catch((err) => {
  console.error('❌', err.message ?? err);
  process.exit(1);
});
