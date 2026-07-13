// backend/check_sample_mflix.ts
// Checks whether the sample_mflix demo database is still sitting in your
// MongoDB Atlas cluster (wastes 164MB of your 512MB free-tier quota) and
// drops it if found. Safe to run — sample_mflix is Atlas's own demo data,
// never used by MiniGuru.
//
// Run with: cd backend && npx ts-node check_sample_mflix.ts

import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    console.error('DATABASE_URL not found in backend/.env');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const admin = client.db().admin();
    const { databases } = await admin.listDatabases();

    console.log('Databases currently in this cluster:');
    databases.forEach((db) => console.log(`  - ${db.name}  (${(db.sizeOnDisk! / 1024 / 1024).toFixed(1)} MB)`));

    const hasMflix = databases.some((db) => db.name === 'sample_mflix');
    if (!hasMflix) {
      console.log('\n✅ sample_mflix is NOT present — nothing to clean up. Quota is already clean.');
      return;
    }

    console.log('\n⚠️  sample_mflix found — dropping it now...');
    await client.db('sample_mflix').dropDatabase();
    console.log('✅ sample_mflix dropped. Quota freed up.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
