import {  Response, NextFunction } from "express";
import { RequestWithUser } from "../interfaces/common.interface";
import { AsyncLocalStorage } from "async_hooks";

export interface TenantContext {
  loginid: string;
  tenantId: string;
  userId?: string;
  email?: string;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export async function tenantContextMiddleware(
  req: RequestWithUser,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.loginid) {
      console.log(`[tenantContextMiddleware]  No user context yet (public route or unauthenticated)`);
      return next();
    }

    console.log(`[tenantContextMiddleware] MIDDLEWARE CALLED for user: ${req.user.loginid}`);
    console.log(`[tenantContextMiddleware] STEP 1: User from req: ${req.user.loginid}`);

    let tenantId = (req.user && (req.user as any).tenantId) || (req as any).tenantId;

    if (!tenantId) {
      console.log(`[tenantContextMiddleware] STEP 2: Tenant not set, looking up from database...`);
      return next();
    } else {
      console.log(`[tenantContextMiddleware] STEP 2: Tenant already set: ${tenantId}`);
    }

    if (!tenantId) {
      // Single-tenant fallback: use default tenant id
      tenantId = process.env.DEFAULT_TENANT || "DEFAULT_TENANT";
      console.log(`[tenantContextMiddleware] No tenant in request; falling back to ${tenantId}`);
    }

    console.log(`[tenantContextMiddleware]  Tenant detected: ${tenantId} for user: ${req.user.loginid}`);

    // Create tenant context
    const tenantContext: TenantContext = {
      loginid: req.user.loginid,
      tenantId: tenantId,
      userId: req.user.id,
      email: req.user.email_id,
    };

    // Attach to request for direct access
    req.user!.tenantId = tenantId;
    (req as any).tenantContext = tenantContext;
    
    console.log(`[tenantContextMiddleware] CONTEXT SET: loginid=${req.user!.loginid}, tenant=${tenantId}, schema=${tenantId.split('_')[0]}`);
    
    (global as any).__currentRequestContext = tenantContext;

    tenantContextStorage.enterWith(tenantContext);
    
    // Single-tenant mode: no schema switching required. Ensure tenant context set.
    console.log(`[tenantContextMiddleware] Single-tenant mode: skipping schema switch, tenant=${tenantId}`);
    
    // ✨ Clear global context when response finishes to prevent memory leaks
    res.on('finish', () => {
      if ((global as any).__currentRequestContext?.tenantId === tenantId) {
        (global as any).__currentRequestContext = undefined;
      }
    });
    
    // Now safe to call next() since schema switch awaited
    next();
  } catch (error: any) {
    console.error(`[tenantContextMiddleware]  ERROR:`, error.message);
    res.status(500).json({
      success: false,
      message: "Error setting up tenant context",
      error: error.message,
    });
  }
}


export function getCurrentTenantContext(): TenantContext | undefined {
  // ✨ CRITICAL FIX: Check AsyncLocalStorage first (for direct calls)
  const asyncContext = tenantContextStorage.getStore();
  if (asyncContext) {
    return asyncContext;
  }
  
  // ✨ FALLBACK: If AsyncLocalStorage fails, try to get from global request context
  // This handles the case where Express switches async contexts on next()
  if ((global as any).__currentRequestContext) {
    return (global as any).__currentRequestContext;
  }
  
  return undefined;
}

export function getCurrentLoginid(): string | undefined {
  const context = getCurrentTenantContext();
  return context?.loginid;
}

export function getCurrentTenantId(): string | undefined {
  const context = getCurrentTenantContext();
  return context?.tenantId;
}


export async function runInTenantContext<T>(
  loginid: string,
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  const context: TenantContext = { loginid, tenantId };
  return new Promise((resolve, reject) => {
    tenantContextStorage.run(context, async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
}
