import { db } from '../app/lib/db';
import { brands, wrestlers, wrestlerNames, groups, groupMembers, customPredictionTemplates } from '../app/lib/schema';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

interface RosterData {
  brand: string;
  wrestlers: { name: string; groups: string[] }[];
  groups: string[];
}

async function seed() {
  console.log('Seeding database...\n');

  // Check if data already exists
  const existingBrands = await db.select().from(brands).limit(1);
  if (existingBrands.length > 0) {
    console.log('Database already seeded. Skipping.\n');
    console.log('Run "bun db:reset" first to clear existing data.');
    return;
  }

  // Load roster data
  const rosterPath = join(process.cwd(), 'init', 'aew_roster.json');
  const rosterData: RosterData = JSON.parse(readFileSync(rosterPath, 'utf-8'));

  // Create brand
  console.log(`Creating brand: ${rosterData.brand}...`);
  const brandId = randomUUID();
  await db.insert(brands).values({
    id: brandId,
    name: rosterData.brand,
  });
  console.log(`  Created brand: ${rosterData.brand}\n`);

  // Create groups
  console.log(`Creating ${rosterData.groups.length} groups...`);
  const groupIdMap = new Map<string, string>();

  for (const groupName of rosterData.groups) {
    const groupId = randomUUID();
    groupIdMap.set(groupName, groupId);
    await db.insert(groups).values({
      id: groupId,
      name: groupName,
      brandId: brandId,
    });
  }
  console.log(`  Created ${rosterData.groups.length} groups\n`);

  // Create wrestlers and group memberships
  console.log(`Creating ${rosterData.wrestlers.length} wrestlers...`);
  let membershipCount = 0;
  const now = new Date();

  for (const wrestler of rosterData.wrestlers) {
    const wrestlerId = randomUUID();
    await db.insert(wrestlers).values({
      id: wrestlerId,
      currentName: wrestler.name,
      brandId: brandId,
    });

    // Create initial name history entry
    await db.insert(wrestlerNames).values({
      id: randomUUID(),
      wrestlerId: wrestlerId,
      name: wrestler.name,
      validFrom: now,
      validTo: null,
    });

    // Create group memberships
    for (const groupName of wrestler.groups) {
      const groupId = groupIdMap.get(groupName);
      if (groupId) {
        await db.insert(groupMembers).values({
          id: randomUUID(),
          groupId: groupId,
          wrestlerId: wrestlerId,
          joinedAt: now,
        });
        membershipCount++;
      }
    }
  }
  console.log(`  Created ${rosterData.wrestlers.length} wrestlers`);
  console.log(`  Created ${membershipCount} group memberships\n`);

  // Create custom prediction templates
  console.log('Creating custom prediction templates...');
  const templates = [
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
  ];

  await db.insert(customPredictionTemplates).values(templates);
  console.log(`  Created ${templates.length} templates\n`);

  // Summary
  console.log('Seed completed successfully!\n');
  console.log('Summary:');
  console.log(`  - 1 brand (${rosterData.brand})`);
  console.log(`  - ${rosterData.groups.length} groups`);
  console.log(`  - ${rosterData.wrestlers.length} wrestlers`);
  console.log(`  - ${membershipCount} group memberships`);
  console.log(`  - ${templates.length} custom prediction templates`);
  console.log('\nRun "bun db:studio" to view the data in Drizzle Studio');
}

seed().catch(console.error);
