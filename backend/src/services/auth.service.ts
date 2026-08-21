import bcrypt from "bcrypt";
import { mysqlDb } from "../database/connection";

const AUTH_TABLE = process.env.AUTH_TABLE || "SEC_LOGINTEST";

export class AuthService {
  static async findUser(identifier: string) {
    const result = await mysqlDb.query(
      `SELECT LOGINID, USERNAME, EMAIL_ID, CONTACT_EMAIL, USERPASS, SEC_PASSWD, COMPANY_CODE, ACTIVE_FLAG
         FROM ${AUTH_TABLE}
        WHERE (LOWER(TRIM(COALESCE(EMAIL_ID, ''))) = LOWER(:identifier)
           OR LOWER(TRIM(COALESCE(CONTACT_EMAIL, ''))) = LOWER(:identifier)
           OR LOWER(TRIM(LOGINID)) = LOWER(:identifier))
          AND COALESCE(ACTIVE_FLAG, 'Y') IN ('Y', '1')
        LIMIT 1`,
      { identifier: String(identifier || "").trim() }
    );
    return (result.rows as any[])?.[0] || null;
  }

  static async verifyPassword(password: string, user: any) {
    for (const hash of [user?.USERPASS, user?.SEC_PASSWD].filter(Boolean)) {
      if (await bcrypt.compare(password, hash)) return true;
    }
    return false;
  }

  static async updatePassword(identifier: string, password: string) {
    const hash = await bcrypt.hash(password, 12);
    const result = await mysqlDb.query(
      `UPDATE ${AUTH_TABLE}
          SET USERPASS = :hash, SEC_PASSWD = :hash
        WHERE LOWER(TRIM(COALESCE(EMAIL_ID, ''))) = LOWER(:identifier)
           OR LOWER(TRIM(COALESCE(CONTACT_EMAIL, ''))) = LOWER(:identifier)
           OR LOWER(TRIM(LOGINID)) = LOWER(:identifier)`,
      { hash, identifier: String(identifier || "").trim() }
    );
    return Number(result.rowsAffected || 0) > 0;
  }
}
