/**
 * Reads for the shared settings service.
 *
 * The settings service no longer hands out a per-namespace handle: a namespace
 * is a profile entry id, and its resolved value is published through the
 * schema-derived descriptors. These helpers keep the Desktop's reads in one
 * place so each call site does not repeat the descriptor lookup.
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'

/** The resolved value of one settings namespace, or undefined when it has none. */
export function readSettingsValue<T>(ctx: Context, namespace: string): T | undefined {
  const descriptor = ctx.settings
    .describe()
    .find(entry => String(entry.ns) === namespace)
  return descriptor?.value as T | undefined
}

/** The resolved value of one settings namespace, or the supplied fallback. */
export function readSettingsValueOr<T>(ctx: Context, namespace: string, fallback: T): T {
  return readSettingsValue<T>(ctx, namespace) ?? fallback
}
