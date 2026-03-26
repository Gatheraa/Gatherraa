import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'is_audit_enabled';

/**
 * Decorator to enable auditing for a route.
 * @param action Human-readable action name (optional)
 * @param entityName Entity name (optional)
 */
export const Audited = (action?: string, entityName?: string) =>
  SetMetadata(AUDIT_METADATA_KEY, { action, entityName });
