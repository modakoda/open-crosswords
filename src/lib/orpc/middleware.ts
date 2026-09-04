import { ORPCError, os } from "@orpc/server";
import {
  ForbiddenError,
  requireAdmin,
  requireUser,
  type AdminUser,
  type CurrentUser,
} from "@/lib/auth-guard";
import type { RpcContext } from "./context";

const base = os.$context<RpcContext>();

/** No auth required. */
export const publicProcedure = base;

/**
 * Admin-only. Mirrors the old `adminRoute` wrapper in src/lib/api.ts: derives
 * the acting admin from the session/allow-list, never from client input.
 */
export const adminProcedure = base.use(async ({ context, next }) => {
  let admin: AdminUser;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      throw new ORPCError("FORBIDDEN", { message: "Admin access required" });
    }
    throw err;
  }
  return next({ context: { ...context, admin } });
});

/** Any signed-in client (not necessarily admin). */
export const userProcedure = base.use(async ({ context, next }) => {
  let user: CurrentUser;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      throw new ORPCError("UNAUTHORIZED", { message: "Sign-in required" });
    }
    throw err;
  }
  return next({ context: { ...context, user } });
});
