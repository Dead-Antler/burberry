import { db } from '../app/lib/db';
import { users } from '../app/lib/schema';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

async function createUser() {
  const email = 'test@example.com';
  const password = 'password123';
  const hashedPassword = await bcrypt.hash(password, 10);

  await db.insert(users).values({
    id: randomUUID(),
    email,
    password: hashedPassword,
    name: 'Test User',
  });

  console.log('User created successfully!');
  console.log('Email:', email);
  console.log('Password:', password);
}

createUser().catch(console.error);
