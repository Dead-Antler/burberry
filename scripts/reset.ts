import { db } from '../app/lib/db';
import {
  userCustomPredictions,
  matchPredictions,
  userEventContrarian,
  eventCustomPredictions,
  matchParticipants,
  matches,
  events,
  groupMembers,
  wrestlerNames,
  groups,
  wrestlers,
  customPredictionTemplates,
  brands,
} from '../app/lib/schema';

async function reset() {
  console.log('Resetting database (preserving users)...\n');

  // Delete in order due to foreign key constraints
  const tables = [
    { name: 'userCustomPredictions', table: userCustomPredictions },
    { name: 'matchPredictions', table: matchPredictions },
    { name: 'userEventContrarian', table: userEventContrarian },
    { name: 'eventCustomPredictions', table: eventCustomPredictions },
    { name: 'matchParticipants', table: matchParticipants },
    { name: 'matches', table: matches },
    { name: 'events', table: events },
    { name: 'groupMembers', table: groupMembers },
    { name: 'wrestlerNames', table: wrestlerNames },
    { name: 'groups', table: groups },
    { name: 'wrestlers', table: wrestlers },
    { name: 'customPredictionTemplates', table: customPredictionTemplates },
    { name: 'brands', table: brands },
  ];

  for (const { name, table } of tables) {
    const result = await db.delete(table);
    console.log(`  Deleted from ${name}`);
  }

  console.log('\nReset complete!');
  console.log('User accounts have been preserved.');
  console.log('\nRun "bun db:seed" to re-seed the database.');
}

reset().catch(console.error);
