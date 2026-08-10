import { Request, Response } from "express";
import oracledb from "oracledb";
import TenantManager from "../../../../database/TenantManager";
import { getCurrentTenantId } from "../../../../middleware/tenantContext.middleware";

type DocAccodeRow = {
  company_code?: string;
  doc_id?: string;
  hdr_dtl?: string;
  ac_code?: string;
  div_code?: string;
};

async function resolveL4Code(
  connection: oracledb.Connection,
  companyCode: string,
  accountCode: string
) {
  const result = await connection.execute<{ L4_CODE: string }>(
    `
      SELECT
        COALESCE(
          MAX(CASE WHEN AC_CODE = :accountCode THEN L4_CODE END),
          MAX(CASE WHEN L4_CODE = :accountCode THEN L4_CODE END)
        ) AS L4_CODE
      FROM MS_ACCODES
      WHERE COMPANY_CODE = :companyCode
        AND (AC_CODE = :accountCode OR L4_CODE = :accountCode)
    `,
    { companyCode, accountCode },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );

  return result.rows?.[0]?.L4_CODE || "";
}

export const insDocAccodeBulk = async (
  req: Request,
  res: Response
): Promise<void> => {
  let connection: oracledb.Connection | undefined;

  try {
    const rows = req.body?.rows;
    const loginId = req.body?.loginId;

    if (!Array.isArray(rows) || !loginId) {
      res.status(400).json({
        success: false,
        message: "rows and loginId required"
      });
      return;
    }

    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      res.status(400).json({
        success: false,
        message: "Tenant not found"
      });
      return;
    }

    connection = await TenantManager.getConnection(tenantId);

    for (const row of rows as DocAccodeRow[]) {
      const companyCode = String(row.company_code || "").trim();
      const docId = String(row.doc_id || "").trim();
      const hdrDtl = String(row.hdr_dtl || "").trim().toUpperCase().slice(0, 1);
      const accountCode = String(row.ac_code || "").trim();
      const divCode = String(row.div_code || "").trim() || null;

      if (!companyCode || !docId || !hdrDtl || !accountCode) {
        throw new Error("company_code, doc_id, hdr_dtl and ac_code are required for every row");
      }

      if (!["H", "D"].includes(hdrDtl)) {
        throw new Error(`Invalid hdr_dtl '${row.hdr_dtl}'. Use H or D.`);
      }

      const l4Code = await resolveL4Code(connection, companyCode, accountCode);

      if (!l4Code) {
        throw new Error(`Account ${accountCode} is not available in MS_ACCODES for company ${companyCode}`);
      }

      await connection.execute(
        `
          MERGE INTO MS_AC_SETUP_DOC_ACCODE target
          USING (
            SELECT
              :companyCode AS COMPANY_CODE,
              :docId AS DOC_ID,
              :hdrDtl AS HDR_DTL,
              :l4Code AS AC_CODE,
              :divCode AS DIV_CODE
            FROM DUAL
          ) src
          ON (
            target.COMPANY_CODE = src.COMPANY_CODE
            AND target.DOC_ID = src.DOC_ID
            AND target.HDR_DTL = src.HDR_DTL
            AND target.AC_CODE = src.AC_CODE
            AND NVL(target.DIV_CODE, 'X') = NVL(src.DIV_CODE, 'X')
          )
          WHEN NOT MATCHED THEN
            INSERT (COMPANY_CODE, DOC_ID, HDR_DTL, AC_CODE, DIV_CODE)
            VALUES (src.COMPANY_CODE, src.DOC_ID, src.HDR_DTL, src.AC_CODE, src.DIV_CODE)
        `,
        { companyCode, docId, hdrDtl, l4Code, divCode }
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Document Account Codes inserted successfully"
    });
  } catch (err: any) {
    console.error("Oracle Error:", err);

    if (connection) await connection.rollback();

    res.status(500).json({
      success: false,
      message: "Transaction failed",
      details: err?.message || "Unknown error"
    });
  } finally {
    if (connection) await connection.close();
  }
};
