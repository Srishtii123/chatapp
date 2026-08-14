/**
 * This file has been simplified for a single-tenant MySQL deployment.
 * All tenant/schema switching and Oracle-specific session commands are removed.
 * The exported helpers are no-ops or thin pass-throughs to keep compatibility
 * with existing service code that imports these symbols.
 */

export async function ensureCorrectSchema(): Promise<void> {
  // Single-tenant: nothing to do.
  return;
}

export async function ensureCorrectSchemaOnQueryRunner(_queryRunner: any): Promise<void> {
  // No schema switching required for single-tenant MySQL
  return;
}

export async function createTenantQueryBuilder<Entity>(
  repository: any,
  alias: string
): Promise<any> {
  // Single-tenant: return normal query builder
  return repository.createQueryBuilder(alias);
}

export function AutoSchemaSwitch() {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    return descriptor; // no-op decorator
  };
}

export function wrapRepositoryForTenant<Entity>(
  repository: any,
  _name: string
): any {
  // Return repository as-is for single-tenant mode
  return repository;
}
