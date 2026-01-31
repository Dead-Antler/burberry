import { db } from '../app/lib/db';
import { brands, customPredictionTemplates } from '../app/lib/schema';
import { randomUUID } from 'crypto';

async function seedWrestlingData() {
  console.log('Seeding wrestling data...\n');

  // Create brands
  console.log('Creating brands...');
  const wweId = randomUUID();
  const aewId = randomUUID();

  await db.insert(brands).values([
    {
      id: wweId,
      name: 'WWE',
    },
    {
      id: aewId,
      name: 'AEW',
    },
  ]);
  console.log('✓ Created brands: WWE, AEW\n');

  // Create custom prediction templates
  console.log('Creating custom prediction templates...');

  await db.insert(customPredictionTemplates).values([
    {
      id: randomUUID(),
      name: 'First Blood',
      description: 'Predict when a specific wrestler will bleed during a match',
      predictionType: 'time',
    },
    {
      id: randomUUID(),
      name: 'Physicality Counter',
      description: 'Count how many times the word "Physicality" is mentioned',
      predictionType: 'count',
    },
    {
      id: randomUUID(),
      name: 'Returns and Debuts',
      description: 'Predict which wrestler will return or debut at the event',
      predictionType: 'wrestler',
    },
    {
      id: randomUUID(),
      name: 'Tables Broken',
      description: 'Count how many tables get broken during the event',
      predictionType: 'count',
    },
    {
      id: randomUUID(),
      name: 'Will There Be Interference?',
      description: 'Predict if there will be outside interference in a specific match',
      predictionType: 'boolean',
    },
  ]);
  console.log('✓ Created 5 custom prediction templates\n');

  console.log('Seed data created successfully!');
  console.log('\nSummary:');
  console.log('- 2 brands (WWE, AEW)');
  console.log('- 5 custom prediction templates');
  console.log('\nRun "bun db:studio" to view the data in Drizzle Studio');
}

seedWrestlingData().catch(console.error);
