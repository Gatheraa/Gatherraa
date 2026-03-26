export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  ACCESS = 'ACCESS',
  UPLOAD = 'UPLOAD',
  DOWNLOAD = 'DOWNLOAD',
  SENSITIVE_VIEW = 'SENSITIVE_VIEW',
  AUTH_FAILURE = 'AUTH_FAILURE',
  SCHEMA_CHANGE = 'SCHEMA_CHANGE',
  EXPORT = 'EXPORT',
}

export const AUDIT_SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'private',
  'nonce',
  'creditCard',
  'ssn',
];
