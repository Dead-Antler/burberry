#!/usr/bin/env tsx

/**
 * Test script for Enhanced Rate Limiter
 * Tests LRU eviction, IPv6 normalization, metrics, and edge cases
 */

import {
  rateLimit,
  resetRateLimit,
  getRateLimiterMetrics,
  getRateLimiterHealth,
} from '../app/lib/rate-limit';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('🧪 Testing Enhanced Rate Limiter\n');

  // Test 1: Basic rate limiting
  console.log('Test 1: Basic rate limiting (5 requests in 1 second)');
  for (let i = 1; i <= 7; i++) {
    const result = rateLimit('test-ip-1', { limit: 5, windowMs: 1000 });
    console.log(
      `  Request ${i}: ${result.success ? '✅ PASS' : '❌ FAIL'} (remaining: ${result.remaining})`
    );
  }
  console.log('');

  // Test 2: IPv6 normalization
  console.log('Test 2: IPv6 normalization (different formats, same IP)');
  const ipv6Variations = [
    '2001:0db8:0000:0000:0000:0000:0000:0001',
    '2001:db8:0:0:0:0:0:1',
    '2001:db8::1',
    '2001:DB8::1', // uppercase
  ];

  resetRateLimit(ipv6Variations[0]); // Reset before test

  for (const ip of ipv6Variations) {
    const result = rateLimit(ip, { limit: 3, windowMs: 5000 });
    console.log(`  ${ip} → ${result.success ? '✅ PASS' : '❌ FAIL'} (remaining: ${result.remaining})`);
  }
  console.log('  Expected: All variations treated as same IP (count increments)\n');

  // Test 3: Window expiration
  console.log('Test 3: Window expiration (should reset after 1 second)');
  resetRateLimit('test-ip-2');

  const r1 = rateLimit('test-ip-2', { limit: 3, windowMs: 1000 });
  console.log(`  Request 1: ${r1.success ? '✅ PASS' : '❌ FAIL'} (remaining: ${r1.remaining})`);

  const r2 = rateLimit('test-ip-2', { limit: 3, windowMs: 1000 });
  console.log(`  Request 2: ${r2.success ? '✅ PASS' : '❌ FAIL'} (remaining: ${r2.remaining})`);

  console.log('  Waiting 1.1 seconds for window to expire...');
  await sleep(1100);

  const r3 = rateLimit('test-ip-2', { limit: 3, windowMs: 1000 });
  console.log(`  Request 3 (after expiry): ${r3.success ? '✅ PASS' : '❌ FAIL'} (remaining: ${r3.remaining})`);
  console.log(`  Expected: remaining should be 2 (counter reset)\n`);

  // Test 4: Metrics collection
  console.log('Test 4: Metrics collection');
  const metrics = getRateLimiterMetrics();
  console.log(`  Total Requests: ${metrics.totalRequests}`);
  console.log(`  Rejections: ${metrics.rejections}`);
  console.log(`  Evictions: ${metrics.evictions}`);
  console.log(`  Cleanups: ${metrics.cleanups}`);
  console.log(`  Current Entries: ${metrics.currentEntries}`);
  console.log(`  Capacity: ${metrics.capacityPercent}%\n`);

  // Test 5: Health check
  console.log('Test 5: Health check');
  const health = getRateLimiterHealth();
  console.log(`  Status: ${health.status}`);
  console.log(`  Healthy: ${health.healthy ? '✅ YES' : '❌ NO'}`);
  console.log(`  Message: ${health.message}\n`);

  // Test 6: Multiple unique IPs (simulate load)
  console.log('Test 6: Multiple unique IPs (simulating realistic load)');
  const uniqueIPs = 100;
  for (let i = 0; i < uniqueIPs; i++) {
    rateLimit(`192.168.1.${i}`, { limit: 10, windowMs: 60000 });
  }

  const afterLoadMetrics = getRateLimiterMetrics();
  console.log(`  Created ${uniqueIPs} unique IP entries`);
  console.log(`  Current Entries: ${afterLoadMetrics.currentEntries}`);
  console.log(`  Capacity: ${afterLoadMetrics.capacityPercent}%`);
  console.log(`  Expected: Should handle ${uniqueIPs} IPs without issues\n`);

  // Test 7: Different rate limit windows
  console.log('Test 7: Different rate limit windows (concurrent)');
  resetRateLimit('test-ip-3');

  const short = rateLimit('test-ip-3', { limit: 2, windowMs: 1000 });
  const long = rateLimit('test-ip-3', { limit: 5, windowMs: 5000 });

  console.log(`  Short window (1s, limit 2): remaining ${short.remaining}`);
  console.log(`  Long window (5s, limit 5): remaining ${long.remaining}`);
  console.log(`  Note: Each identifier+window is tracked separately\n`);

  // Test 8: Reset functionality
  console.log('Test 8: Reset functionality');
  resetRateLimit('test-ip-4');

  rateLimit('test-ip-4', { limit: 3, windowMs: 60000 });
  rateLimit('test-ip-4', { limit: 3, windowMs: 60000 });
  rateLimit('test-ip-4', { limit: 3, windowMs: 60000 });

  let beforeReset = rateLimit('test-ip-4', { limit: 3, windowMs: 60000 });
  console.log(`  Before reset: ${beforeReset.success ? '✅ PASS' : '❌ FAIL'} (should fail, limit reached)`);

  resetRateLimit('test-ip-4');

  let afterReset = rateLimit('test-ip-4', { limit: 3, windowMs: 60000 });
  console.log(`  After reset: ${afterReset.success ? '✅ PASS' : '❌ FAIL'} (should pass, counter reset)\n`);

  // Final metrics
  console.log('📊 Final Metrics Summary');
  const finalMetrics = getRateLimiterMetrics();
  const finalHealth = getRateLimiterHealth();

  console.log(`  Total Requests Processed: ${finalMetrics.totalRequests}`);
  console.log(`  Total Rejections: ${finalMetrics.rejections}`);
  console.log(`  Total Evictions: ${finalMetrics.evictions}`);
  console.log(`  Total Cleanups: ${finalMetrics.cleanups}`);
  console.log(`  Current Active Entries: ${finalMetrics.currentEntries}`);
  console.log(`  Memory Capacity Used: ${finalMetrics.capacityPercent}%`);
  console.log(`  Overall Health: ${finalHealth.status.toUpperCase()}`);

  console.log('\n✅ All tests completed!');
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
