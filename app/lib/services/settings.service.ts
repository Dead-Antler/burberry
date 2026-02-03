/**
 * Settings Service
 *
 * Provides type-safe access to application settings.
 * Handles serialization/deserialization based on setting type.
 * Validates JSON settings against registered schemas.
 */

import { db } from '../db';
import { settings } from '../schema';
import { eq } from 'drizzle-orm';
import {
  SettingType,
  JsonSettingKey,
  JsonSettingValue,
  getJsonSchema,
  isJsonSettingKey,
  simpleSettingDefinitions,
  SimpleSettingKey,
} from '../settings-schemas';

// ============================================================================
// Types
// ============================================================================

interface SettingRecord {
  key: string;
  scope: string;
  type: string;
  value: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// ============================================================================
// Value Serialization/Deserialization
// ============================================================================

function serializeValue(value: unknown, type: SettingType): string {
  switch (type) {
    case 'string':
      return String(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return String(value);
    case 'json':
      return JSON.stringify(value);
    default:
      throw new Error(`Unknown setting type: ${type}`);
  }
}

function deserializeValue(value: string, type: SettingType): unknown {
  switch (type) {
    case 'string':
      return value;
    case 'boolean':
      return value === 'true';
    case 'number':
      return Number(value);
    case 'json':
      return JSON.parse(value);
    default:
      throw new Error(`Unknown setting type: ${type}`);
  }
}

// ============================================================================
// Settings Service
// ============================================================================

export const settingsService = {
  /**
   * Get a JSON setting by key
   * Returns undefined if not set, validates against schema
   */
  async getJson<K extends JsonSettingKey>(key: K): Promise<JsonSettingValue<K> | undefined> {
    const [record] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    if (!record) {
      return undefined;
    }

    if (record.type !== 'json') {
      throw new Error(`Setting "${key}" is not a JSON type (found: ${record.type})`);
    }

    const parsed = JSON.parse(record.value);

    // Validate against schema
    const schema = getJsonSchema(key);
    if (schema) {
      const result = schema.safeParse(parsed);
      if (!result.success) {
        console.error(`Invalid JSON setting "${key}":`, result.error);
        throw new Error(`Invalid JSON setting "${key}": ${result.error.message}`);
      }
      return result.data as JsonSettingValue<K>;
    }

    return parsed as JsonSettingValue<K>;
  },

  /**
   * Set a JSON setting
   * Validates against schema before saving
   */
  async setJson<K extends JsonSettingKey>(key: K, value: JsonSettingValue<K>): Promise<void> {
    // Validate against schema
    const schema = getJsonSchema(key);
    if (schema) {
      const result = schema.safeParse(value);
      if (!result.success) {
        throw new Error(`Invalid value for "${key}": ${result.error.message}`);
      }
    }

    const serialized = JSON.stringify(value);
    const now = new Date();

    await db
      .insert(settings)
      .values({
        key,
        scope: 'global',
        type: 'json',
        value: serialized,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: serialized,
          updatedAt: now,
        },
      });
  },

  /**
   * Get a simple (non-JSON) setting by key
   * Returns the default value if not set
   * Note: Uncomment simpleSettingDefinitions entries to use this method
   */
  async getSimple<K extends SimpleSettingKey>(
    key: K
  ): Promise<unknown> {
    const definition = simpleSettingDefinitions[key] as { type: SettingType; default: unknown };

    const [record] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    if (!record) {
      return definition.default;
    }

    return deserializeValue(record.value, definition.type);
  },

  /**
   * Set a simple (non-JSON) setting
   * Note: Uncomment simpleSettingDefinitions entries to use this method
   */
  async setSimple<K extends SimpleSettingKey>(
    key: K,
    value: unknown
  ): Promise<void> {
    const definition = simpleSettingDefinitions[key] as { type: SettingType; default: unknown };
    const serialized = serializeValue(value, definition.type);
    const now = new Date();

    await db
      .insert(settings)
      .values({
        key,
        scope: 'global',
        type: definition.type,
        value: serialized,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: serialized,
          updatedAt: now,
        },
      });
  },

  /**
   * Get a setting by key (generic, untyped)
   * Use getJson() or getSimple() for type safety
   */
  async get(key: string): Promise<unknown | undefined> {
    const [record] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    if (!record) {
      return undefined;
    }

    const value = deserializeValue(record.value, record.type as SettingType);

    // Validate JSON settings
    if (record.type === 'json' && isJsonSettingKey(key)) {
      const schema = getJsonSchema(key);
      if (schema) {
        const result = schema.safeParse(value);
        if (!result.success) {
          console.error(`Invalid JSON setting "${key}":`, result.error);
          throw new Error(`Invalid JSON setting "${key}": ${result.error.message}`);
        }
        return result.data;
      }
    }

    return value;
  },

  /**
   * Set a setting by key (generic, untyped)
   * Use setJson() or setSimple() for type safety
   */
  async set(key: string, value: unknown, type: SettingType): Promise<void> {
    // Validate JSON settings against schema
    if (type === 'json' && isJsonSettingKey(key)) {
      const schema = getJsonSchema(key);
      if (schema) {
        const result = schema.safeParse(value);
        if (!result.success) {
          throw new Error(`Invalid value for "${key}": ${result.error.message}`);
        }
      }
    }

    const serialized = serializeValue(value, type);
    const now = new Date();

    await db
      .insert(settings)
      .values({
        key,
        scope: 'global',
        type,
        value: serialized,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: serialized,
          type,
          updatedAt: now,
        },
      });
  },

  /**
   * Delete a setting
   */
  async delete(key: string): Promise<boolean> {
    const result = await db
      .delete(settings)
      .where(eq(settings.key, key));

    return result.rowsAffected > 0;
  },

  /**
   * List all settings, optionally filtered by namespace prefix
   */
  async list(namespace?: string): Promise<SettingRecord[]> {
    const allSettings = await db.select().from(settings);

    if (namespace) {
      return allSettings.filter((s) => s.key.startsWith(`${namespace}.`));
    }

    return allSettings;
  },
};
