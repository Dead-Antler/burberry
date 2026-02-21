/**
 * Settings Schema Registry
 *
 * Defines validation schemas for JSON settings.
 * Schemas are defined in code (not database) for:
 * - Version control
 * - Type safety
 * - No wasted database space
 */

import { z } from 'zod';

// ============================================================================
// Setting Value Types
// ============================================================================

export const settingTypes = ['string', 'boolean', 'number', 'json'] as const;
export type SettingType = (typeof settingTypes)[number];

export const settingScopes = ['global'] as const; // Future: 'user'
export type SettingScope = (typeof settingScopes)[number];

// ============================================================================
// JSON Setting Schemas
// ============================================================================

/**
 * Registry of JSON setting schemas
 * Keys are namespaced setting keys, values are Zod schemas
 */
export const jsonSettingSchemas = {
  // Future examples:
  // 'scoring.rules': z.object({
  //   correctPrediction: z.number().min(0),
  //   bonusMultiplier: z.number().min(1),
  // }),
  // 'ui.theme': z.object({
  //   primaryColor: z.string(),
  //   darkMode: z.boolean(),
  // }),
} as const;

export type JsonSettingKey = keyof typeof jsonSettingSchemas;

/**
 * Get the Zod schema for a JSON setting key
 */
export function getJsonSchema(key: string): z.ZodType | undefined {
  return jsonSettingSchemas[key as JsonSettingKey];
}

/**
 * Check if a key is a known JSON setting
 */
export function isJsonSettingKey(key: string): key is JsonSettingKey {
  return key in jsonSettingSchemas;
}

// ============================================================================
// Simple Setting Definitions (non-JSON)
// ============================================================================

/**
 * Registry of simple settings with their types and defaults
 * These don't need Zod schemas - just type coercion
 */
export const simpleSettingDefinitions = {
  'auth.signupEnabled': { type: 'boolean', default: false },
} as const satisfies Record<string, { type: Exclude<SettingType, 'json'>; default: unknown }>;

export type SimpleSettingKey = keyof typeof simpleSettingDefinitions;

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Infer the TypeScript type for a JSON setting
 */
export type JsonSettingValue<K extends JsonSettingKey> = z.infer<(typeof jsonSettingSchemas)[K]>;

/**
 * All known setting keys (simple + JSON)
 */
export type SettingKey = SimpleSettingKey | JsonSettingKey;
