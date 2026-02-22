import { db } from '../app/lib/db';
import {
  wrestlerPredictionCooldowns,
  userCustomPredictions,
  matchPredictions,
  userEventJoin,
  eventCustomPredictions,
  customPredictionGroupMembers,
  customPredictionGroups,
  customPredictionTemplates,
  matchParticipants,
  matches,
  events,
  groupMembers,
  wrestlerNames,
  groups,
  wrestlers,
  brands,
} from '../app/lib/schema';

async function reset() {
  console.log('Resetting database (preserving users)...\n');

  // Delete in dependency order (children before parents)
  const tables = [
    { name: 'wrestlerPredictionCooldowns', table: wrestlerPredictionCooldowns },
    { name: 'userCustomPredictions', table: userCustomPredictions },
    { name: 'matchPredictions', table: matchPredictions },
    { name: 'userEventJoin', table: userEventJoin },
    { name: 'eventCustomPredictions', table: eventCustomPredictions },
    { name: 'customPredictionGroupMembers', table: customPredictionGroupMembers },
    { name: 'customPredictionGroups', table: customPredictionGroups },
    { name: 'customPredictionTemplates', table: customPredictionTemplates },
    { name: 'matchParticipants', table: matchParticipants },
    { name: 'matches', table: matches },
    { name: 'events', table: events },
    { name: 'groupMembers', table: groupMembers },
    { name: 'wrestlerNames', table: wrestlerNames },
    { name: 'groups', table: groups },
    { name: 'wrestlers', table: wrestlers },
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
