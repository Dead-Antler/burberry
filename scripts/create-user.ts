import { db } from '../app/lib/db';
import { users } from '../app/lib/schema';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function createUser() {
  console.log('Create New User\n');

  const email = await question('Email: ');
  const password = await question('Password: ');
  const name = await question('Name: ');
  const isAdminInput = await question('Is Admin? (y/n): ');

  const isAdmin = isAdminInput.toLowerCase() === 'y';
  const hashedPassword = await bcrypt.hash(password, 10);

  await db.insert(users).values({
    id: randomUUID(),
    email,
    password: hashedPassword,
    name,
    isAdmin,
  });

  console.log('\n✓ User created successfully!');
  console.log('Email:', email);
  console.log('Name:', name);
  console.log('Admin:', isAdmin);

  rl.close();
  process.exit(0);
}

createUser().catch((error) => {
  console.error('Error creating user:', error);
  rl.close();
  process.exit(1);
});
