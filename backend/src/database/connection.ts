import "reflect-metadata";
import mysql, { Pool, PoolConnection } from "mysql2/promise";

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const uri = process.env.MYSQL_CONNECTION_STRING || process.env.DATABASE_URL;
  pool = uri
    ? mysql.createPool({ uri, waitForConnections: true, connectionLimit: 10 })
    : mysql.createPool({
        host: process.env.MYSQL_HOST || "127.0.0.1",
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || "root",
        password: process.env.MYSQL_PASSWORD || "",
        database: process.env.MYSQL_DATABASE || process.env.DATABASE || "support_chat",
        waitForConnections: true,
        connectionLimit: 10,
      });
  return pool;
}

function prepare(sql: string, binds: Record<string, unknown> = {}) {
  const values: unknown[] = [];
  const statement = sql.replace(/:(\w+)/g, (_match, name: string) => {
    values.push(binds[name]);
    return "?";
  });
  return { statement, values };
}

export const mysqlDb = {
  async authenticate() { await getPool().query("SELECT 1"); },
  async getConnection() { return getPool().getConnection(); },
  async query(sql: string, binds: Record<string, unknown> = {}, connection?: PoolConnection) {
    const { statement, values } = prepare(sql, binds);
    const [rows] = await (connection || getPool()).query(statement, values);
    const packet = rows as any;
    return { rows: rows as any, rowsAffected: packet?.affectedRows, insertId: packet?.insertId, outBinds: undefined as any };
  },
  async withTransaction<T>(work: (connection: PoolConnection) => Promise<T>) {
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
  async close() { if (pool) await pool.end(); pool = null; },
};

export async function initializeDatabase() {
  await mysqlDb.authenticate();
  console.log("Connected to the support-chat database");
}
