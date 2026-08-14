import { mysqlDb } from "./connection";

export interface TenantConfig {
  TENANT_ID: string;
  TENANT_NAME: string;
  CONNECTION_TYPE: string;
  SCHEMA_NAME?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_HOST?: string;
  DB_PORT?: number;
  COMPANY_CODE?: string;
  IS_ACTIVE?: string;
}

export class TenantManager {
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized) return;
    // Initialize central MySQL pool
    await mysqlDb.authenticate();
    this.initialized = true;
    console.log("TenantManager: initialized single-tenant MySQL connection");
  }

  // For single-tenant mode, return a default tenant id
  static async getTenantForUser(_loginid: string): Promise<string> {
    return process.env.DEFAULT_TENANT || "DEFAULT_TENANT";
  }

  static async getTenantConfig(tenantId: string): Promise<TenantConfig> {
    // Return a simple config populated from environment for single-tenant setups
    return {
      TENANT_ID: tenantId,
      TENANT_NAME: process.env.TENANT_NAME || tenantId,
      CONNECTION_TYPE: "DATABASE",
      SCHEMA_NAME: process.env.MYSQL_DATABASE || process.env.DATABASE || undefined,
      DB_USER: process.env.MYSQL_USER || process.env.DATABASE_USER,
      DB_PASSWORD: process.env.MYSQL_PASSWORD || process.env.DATABASE_PASSWORD,
      DB_HOST: process.env.MYSQL_HOST,
      DB_PORT: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : undefined,
      COMPANY_CODE: process.env.COMPANY_CODE || "",
      IS_ACTIVE: "Y",
    };
  }

  static async getConnection(_tenantId?: string) {
    await this.initialize();
    return await mysqlDb.getConnection();
  }

  static async executeInTenant(
    _tenantId: string,
    query: string,
    params: any = {}
  ): Promise<any[]> {
    // Single-tenant: execute against central MySQL
    const result = await mysqlDb.query(query, params);
    return result.rows || [];
  }

  static async executeForUser(_loginid: string, query: string, params: any = {}): Promise<any[]> {
    const tenantId = process.env.DEFAULT_TENANT || "DEFAULT_TENANT";
    return await this.executeInTenant(tenantId, query, params);
  }

  static async listActiveTenants(): Promise<string[]> {
    return [process.env.DEFAULT_TENANT || "DEFAULT_TENANT"];
  }

  static async runForTenant<T>(tenantId: string, fn: () => Promise<T>, opts?: { loginid?: string }): Promise<T> {
    const { tenantContextStorage } = require("../middleware/tenantContext.middleware");
    const context = { loginid: opts?.loginid || "SYSTEM_SCHEDULER", tenantId };
    return new Promise<T>((resolve, reject) => {
      try {
        tenantContextStorage.run(context, async () => {
          (global as any).__currentRequestContext = context;
          try {
            const res = await fn();
            resolve(res);
          } catch (err) {
            reject(err);
          } finally {
            if ((global as any).__currentRequestContext?.tenantId === tenantId) {
              delete (global as any).__currentRequestContext;
            }
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  static async closeAll(): Promise<void> {
    try { await mysqlDb.close(); } catch (e) { console.warn('mysql close failed', e); }
  }
}

export default TenantManager;
