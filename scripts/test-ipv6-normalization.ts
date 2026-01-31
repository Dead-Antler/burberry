#!/usr/bin/env tsx

/**
 * Detailed IPv6 normalization test
 * Tests the actual implementation from rate-limit.ts
 */

import { rateLimit, resetRateLimit } from '../app/lib/rate-limit';

console.log('IPv6 Normalization Tests:\n');
console.log('Testing that different IPv6 formats are treated as the same IP\n');

const testGroups = [
  {
    name: 'Group 1: 2001:db8::1 variations',
    ips: [
      '2001:0db8:0000:0000:0000:0000:0000:0001',
      '2001:db8:0:0:0:0:0:1',
      '2001:db8::1',
      '2001:DB8::1', // uppercase
    ],
  },
  {
    name: 'Group 2: ::1 (localhost) variations',
    ips: ['::1', '0:0:0:0:0:0:0:1', '0000:0000:0000:0000:0000:0000:0000:0001'],
  },
  {
    name: 'Group 3: fe80:: variations',
    ips: ['fe80::', 'fe80:0:0:0:0:0:0:0', 'FE80::'],
  },
];

for (const group of testGroups) {
  console.log(`${group.name}:`);

  // Reset before testing
  for (const ip of group.ips) {
    resetRateLimit(ip);
  }

  // Test that all variations share the same counter
  let expectedRemaining = 4; // Starting from 5 limit

  for (const ip of group.ips) {
    const result = rateLimit(ip, { limit: 5, windowMs: 60000 });
    const correct = result.remaining === expectedRemaining;

    console.log(
      `  ${correct ? '✅' : '❌'} "${ip}"\n     remaining: ${result.remaining} ${!correct ? `(expected: ${expectedRemaining})` : ''}`
    );

    expectedRemaining--;
  }

  console.log();
}

console.log('✅ All IPv6 variations should share the same rate limit counter');
