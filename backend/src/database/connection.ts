import "reflect-metadata";
import mysql from "mysql2/promise";
import { DataSource, Repository, EntityTarget, ObjectLiteral } from "typeorm";
import constants from "../helpers/constants";

import {
  AccessRoleAppAccess,
  AccessSecModuleData,
  AccessSecOperation,
  AccessUserSecMaster,
  AccessUserSecRoleAccess,
  Company,
  FlowMaster,
  MSCompanyUserAssign,
  MSHRDivisionMaster,
  MSPSProjectMaster,
  MSProjectUserAssign,
  MsPsUserRoleMapping,
  MsRole,
  QueryMaster,
  ReportMaster,
  RoleMaster,
  SecLogin,
  SecLoginRoleAccess,
  SecLoginUserDivision,
  SecModule,
  User,
} from "../entity/Security";

// MySQL/raw pool config
const dbConfig: any = {
  host: constants.DATABASE.MYSQL_HOST || process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(constants.DATABASE.MYSQL_PORT || process.env.MYSQL_PORT) || 3306,
  user: constants.DATABASE.MYSQL_USER || process.env.MYSQL_USER || "root",
  password: constants.DATABASE.MYSQL_PASSWORD || process.env.MYSQL_PASSWORD || "",
  database: constants.DATABASE.MYSQL_DATABASE || process.env.MYSQL_DATABASE || "",
  waitForConnections: true,
  connectionLimit: 10,
};

// ==================== TYPEORM CONFIG - FIXED ====================
export const AppDataSource = new DataSource({
  type: "mysql",
  // Use URL if provided, otherwise use host/port/database fields
  url: constants.DATABASE.MYSQL_CONNECTION_STRING || process.env.MYSQL_CONNECTION_STRING,
  host: constants.DATABASE.MYSQL_HOST || process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(constants.DATABASE.MYSQL_PORT || process.env.MYSQL_PORT) || 3306,
  username: constants.DATABASE.MYSQL_USER || process.env.MYSQL_USER,
  password: constants.DATABASE.MYSQL_PASSWORD || process.env.MYSQL_PASSWORD,
  database: constants.DATABASE.MYSQL_DATABASE || process.env.MYSQL_DATABASE,
  synchronize: false,
  logging: true,
  entities: [
  AccessRoleAppAccess,
  AccessSecModuleData,
  AccessSecOperation,
  AccessUserSecMaster,
  AccessUserSecRoleAccess,
  Company,
  FlowMaster,
  MSCompanyUserAssign,
  MSHRDivisionMaster,
  MSPSProjectMaster,
  MSProjectUserAssign,
  MsPsUserRoleMapping,
  MsRole,
  QueryMaster,
  ReportMaster,
  RoleMaster,
  SecLogin,
  SecLoginRoleAccess,
  SecLoginUserDivision,
  SecModule,
  User,
],

  migrations: ["src/migration/**/*.ts"],
  subscribers: ["src/subscriber/**/*.ts"],
  extra: {
    poolMin: 5,
    poolMax: 20,
    poolIncrement: 2,
    poolTimeout: 60,
  },
});

// ==================== TYPEORM SERVICE ====================
class TypeORMService {
  private static initialized = false;
  private static initPromise: Promise<void> | null = null;

  static async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.initialized && AppDataSource.isInitialized) {
      return;
    }

    this.initPromise = this._performInitialize();
    return this.initPromise;
  }

  private static async _performInitialize(): Promise<void> {
    try {
      if (!AppDataSource.isInitialized) {
        console.log("Attempting TypeORM connection...");
        console.log("TypeORM Config:", {
          type: "MYSQL",
          connectString:
            constants.DATABASE.MYSQL_CONNECTION_STRING ||
            process.env.MYSQL_CONNECTION_STRING,
          username: process.env.MYSQL_USER,
        });

        await AppDataSource.initialize();
        console.log("TypeORM Connected to MYSQL Database");

        // No Oracle session settings required for MySQL single-tenant setup.

        this.initialized = true;
        this.initPromise = null;
      }
    } catch (error) {
      this.initPromise = null;
      console.error("TypeORM connection failed:", error);
      console.log("TypeORM failed, but raw MYSQL connection is active");
      throw error;
    }
  }

  static getRepository<T extends ObjectLiteral>(
    entity: EntityTarget<T>
  ): Repository<T> {
    if (!this.initialized || !AppDataSource.isInitialized) {
      console.error("TypeORM not initialized. Current state:", {
        serviceInitialized: this.initialized,
        dataSourceInitialized: AppDataSource.isInitialized
      });
      throw new Error("TypeORM not initialized. Call initialize() first.");
    }
    if (!this.initialized && AppDataSource.isInitialized) {
      this.initialized = true;
    }

    const repo = AppDataSource.getRepository(entity);

    const dataMethods = new Set([
      "find",
      "findOne",
      "findOneBy",
      "findBy",
      "findAndCount",
      "count",
      "save",
      "update",
      "delete",
      "remove",
      "createQueryBuilder",
      "query"
    ]);

    // Methods that return synchronous objects (not promises) and shouldn't be awaited
    const syncMethods = new Set(["createQueryBuilder"]);

    return new Proxy(repo, {
      get(target, prop: string | symbol) {
        const value: any = Reflect.get(target, prop as any);
        if (typeof prop === "string" && typeof value === "function" && dataMethods.has(prop)) {
          // For synchronous methods like createQueryBuilder, don't wrap with async/await
          if (syncMethods.has(prop)) {
            return function (...args: any[]) {
              try {
                // Dynamic require to avoid circular import at module load
                const { ensureCorrectSchema } = require("./TypeORMTenantInterceptor");
                if (ensureCorrectSchema) {
                  // Don't await schema check for sync methods - just trigger it
                  ensureCorrectSchema().catch((err: any) => {
                    console.warn("ensureCorrectSchema failed:", err);
                  });
                }
              } catch (err) {
                console.warn("ensureCorrectSchema failed:", err);
              }
              return value.apply(target, args);
            };
          }
          // For async methods, wrap with async/await
          return async function (...args: any[]) {
            try {
              // Dynamic require to avoid circular import at module load
              const { ensureCorrectSchema } = require("./TypeORMTenantInterceptor");
              if (ensureCorrectSchema) await ensureCorrectSchema();
            } catch (err) {
              console.warn("ensureCorrectSchema failed:", err);
            }
            return await value.apply(target, args);
          };
        }
        return value;
      },
    }) as unknown as Repository<T>;
  }

  static async ensureConnection(): Promise<void> {
    try {
      if (!AppDataSource.isInitialized) {
        console.log("Connection lost - reinitializing...");
        this.initialized = false;
        this.initPromise = null;
        await this.initialize();
        console.log(" Connection restored");
        return;
      }
      await AppDataSource.query("SELECT 1");
    } catch (error) {
      console.log("Connection health check failed - reconnecting...");
      this.initialized = false;
      this.initPromise = null;
      
      try {
        await AppDataSource.destroy();
      } catch (destroyErr) {
        console.warn("Error destroying connection:", destroyErr);
      }
      
      await this.initialize();
      console.log("Connection restored after health check");
    }
  }

  static async close(): Promise<void> {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      this.initialized = false;
      console.log("TypeORM connection closed");
    } else {
      this.initialized = false;
    }
  }

  static isConnected(): boolean {
    return AppDataSource.isInitialized || this.initialized;
  }

  static isInitialized(): boolean {
    return this.initialized && AppDataSource.isInitialized;
  }
}

function processBindParameters(binds: any): any {
  if (!binds) return {};

  const processedBinds: any = {};

  for (const [key, value] of Object.entries(binds)) {
    if (value === undefined || value === null) {
      processedBinds[key] = { val: null };
    }
    else if (
      value &&
      typeof value === "object" &&
      ("val" in value ||
        "dir" in value ||
        "type" in value ||
        "maxSize" in value)
    ) {
      processedBinds[key] = value;
    }
    else if (
      value &&
      typeof value === "object" &&
      Object.keys(value).length === 0
    ) {
      processedBinds[key] = { val: null };
    } else {
      processedBinds[key] = { val: value };
    }
  }

  return processedBinds;
}

// ==================== RAW MYSQL FUNCTIONS ====================
// Legacy "MYSQLDb" removed. Use `mysqlDb` (mysql2/promise) for pool and queries.

// ==================== MYSQL COMPATIBILITY WRAPPER ====================
let mysqlPool: mysql.Pool | null = null;

function replaceNamedBinds(sql: string, binds: any) {
  if (!binds) return { sql, values: [] };
  const values: any[] = [];
  // Replace :name with ? preserving order
  const newSql = sql.replace(/:(\w+)/g, (_m, name) => {
    values.push(binds[name]);
    return "?";
  });
  return { sql: newSql, values };
}

export const mysqlDb = {
  authenticate: async (opts?: { host?: string; port?: number; user?: string; password?: string; database?: string }) => {
    if (mysqlPool) return;
    const host = opts?.host || process.env.MYSQL_HOST || "127.0.0.1";
    const port = opts?.port || Number(process.env.MYSQL_PORT) || 3306;
    const user = opts?.user || process.env.MYSQL_USER || "root";
    const password = opts?.password || process.env.MYSQL_PASSWORD || "";
    const database = opts?.database || process.env.MYSQL_DATABASE || "test";
    mysqlPool = mysql.createPool({ host, port, user, password, database, waitForConnections: true, connectionLimit: 10, namedPlaceholders: false });
    console.log("MySQL pool created");
  },

  getConnection: async (): Promise<mysql.PoolConnection> => {
    if (!mysqlPool) await mysqlDb.authenticate();
    return (mysqlPool as mysql.Pool).getConnection();
  },

  withTransaction: async <T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> => {
    const conn = await mysqlDb.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (err) {
      try { await conn.rollback(); } catch (e) { console.warn('rollback failed', e); }
      throw err;
    } finally {
      conn.release();
    }
  },

  query: async (sql: string, binds?: any, conn?: any): Promise<any> => {
    const useExternal = Boolean(conn);
    let connection: mysql.PoolConnection | null = null;
    try {
      if (useExternal) {
        connection = conn as mysql.PoolConnection;
      } else {
        connection = await mysqlDb.getConnection();
      }

      // Handle RETURNING ... INTO :param (basic support)
      const returningMatch = /RETURNING\s+([A-Z0-9_]+)\s+INTO\s+:(\w+)/i.exec(sql);
      let returningName: string | null = null;
      if (returningMatch) {
        returningName = returningMatch[2];
        sql = sql.replace(/RETURNING\s+[A-Z0-9_]+\s+INTO\s+:\w+/i, "");
      }

      const { sql: preparedSql, values } = replaceNamedBinds(sql, binds || {});
      const [rows, fields] = await connection.query(preparedSql, values);

      const result: any = { rows };
      // map affectedRows / insertId
      if ((rows as any).affectedRows !== undefined) result.rowsAffected = (rows as any).affectedRows;
      if ((rows as any).insertId !== undefined) result.insertId = (rows as any).insertId;
      if (returningName) {
        result.outBinds = { [returningName]: [(rows as any).insertId] };
      }
      return result;
    } catch (error) {
      console.error("MySQL query failed:", error, sql, binds);
      throw error;
    } finally {
      if (connection && !useExternal) {
        try { connection.release(); } catch (e) { console.warn('release failed', e); }
      }
    }
  },

  close: async () => {
    if (mysqlPool) {
      await mysqlPool.end();
      mysqlPool = null;
    }
  }
};

// ==================== UPDATED INITIALIZATION ====================
export const initializeAllConnections = async (): Promise<void> => {
  console.log("Starting database connections...");

  try {
    // 1. Initialize legacy connection (non-blocking)
    console.log("Initializing legacy MYSQL connection...");
    try {
      await mysqlDb.authenticate();
      console.log("Legacy database connection ready");
    } catch (legacyError) {
      console.warn(" Legacy MYSQL connection failed (app will continue):", legacyError instanceof Error ? legacyError.message : String(legacyError));
      // Continue without legacy connection
    }
    // 2. Initialize TypeORM (optional - don't block if it fails)
    console.log("Initializing TypeORM...");
    try {
      await TypeORMService.initialize();
      console.log(" TypeORM connection ready");
    } catch (typeOrmError) {
      console.warn("TypeORM initialization failed (continuing without it):", typeOrmError instanceof Error ? typeOrmError.message : String(typeOrmError));
      // Continue without TypeORM - application can still work with raw MYSQL
    }

    console.log("Database initialization completed (some services may be unavailable)");
  } catch (error) {
    console.error("Critical database initialization failed:", error);
    throw error;
  }
};

export const closeAllConnections = async (): Promise<void> => {
  await mysqlDb.close();
  await TypeORMService.close();
  console.log("All database connections closed");
};

// ==================== BACKWARD COMPATIBILITY ====================
export const databaseConnection = (): Promise<boolean> => {
  return new Promise(async (resolve) => {
    try {
      await mysqlDb.authenticate();
      // quick health check
      await mysqlDb.query("SELECT 1");
      console.log("MYSQL Database Connected and Session Set");
      resolve(true);
    } catch (error: unknown) {
      console.error(
        "MYSQL authentication failed in databaseConnection check:",
        error
      );
      resolve(false);
    }
  });
};

// ==================== TENANT-AWARE QUERY HELPER ====================
export async function executeInTenantSchema<T>(
  _tenantId: string,
  query: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  // Single-tenant mode: ignore tenantId and run the query against MySQL pool
  const res = await mysqlDb.query(query, params);
  return res.rows || res;
}

// ==================== EXPORTS ====================
export { TypeORMService };
export const getRepository = TypeORMService.getRepository.bind(TypeORMService);
export const isTypeOrmConnected = TypeORMService.isConnected;

// Monkey-patch AppDataSource.createQueryRunner to ensure tenant schema
// is applied on the QueryRunner's underlying connection before any queries run.
// We wrap the returned QueryRunner so its methods await the schema switch.
(() => {
  try {
    const originalCreateQueryRunner = (AppDataSource as any).createQueryRunner.bind(AppDataSource);
    (AppDataSource as any).createQueryRunner = function (...args: any[]) {
      const queryRunner = originalCreateQueryRunner(...args);

      // Lazily start schema enforcement immediately
      let schemaPromise: Promise<void> | null = null;
      try {
        const { ensureCorrectSchemaOnQueryRunner } = require("./TypeORMTenantInterceptor");
        schemaPromise = ensureCorrectSchemaOnQueryRunner(queryRunner).catch((err: any) => {
          console.warn("[createQueryRunner wrapper] ensureCorrectSchemaOnQueryRunner failed:", err);
        });
      } catch (err) {
        // If interceptor cannot be required, continue without schema enforcement
        console.warn("[createQueryRunner wrapper] Could not require TypeORMTenantInterceptor:", err);
      }

      // Return a proxy that ensures the schemaPromise is awaited before executing functions
      return new Proxy(queryRunner, {
        get(target, prop: string | symbol) {
          const value: any = Reflect.get(target, prop as any);
          if (typeof value === "function") {
            return async function (...fnArgs: any[]) {
              if (schemaPromise) {
                await schemaPromise;
              }
              return await value.apply(target, fnArgs);
            };
          }
          return value;
        },
      });
    };
  } catch (err) {
    console.warn("Failed to wrap AppDataSource.createQueryRunner:", err);
  }
})();
export const closeTypeOrmConnection = TypeORMService.close;

// ==================== BIND PARAMETER UTILITY (for external use) ====================
export const createBindObject = (value: any): any => {
  return { val: value };
};

export const createBindObjects = (
  params: Record<string, any>
): Record<string, any> => {
  return processBindParameters(params);
};

// ==================== SEQUELIZE SHIM (LEGACY SUPPORT) ====================
// NOTE: Sequelize is no longer used at runtime. This export is for legacy model file imports only.
// Legacy model files are being phased out in favor of TypeORM entities and MYSQL8 QueryExecutor.
export const sequelize: any = {
  dialect: "MYSQL",
  options: { logging: false },
  // Mock transaction method for legacy code
  transaction: async (callback: any) => {
    // Simple pass-through that just calls the callback with a dummy transaction object
    try {
      return await callback({ commit: async () => {}, rollback: async () => {} });
    } catch (err) {
      throw err;
    }
  },
  query: async (sql: string, options?: any) => {
    // Mock query method that returns empty array
    return [];
  },
};

// Basic QueryTypes shim for legacy code that expects QueryTypes.
export const QueryTypes = {
  SELECT: "SELECT",
  INSERT: "INSERT",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
} as const;
