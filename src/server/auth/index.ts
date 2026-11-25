import "server-only";

// Public server boundary. No confidential eligibility/referral queries or exports.
export { authenticatePassword, endSession, getCurrentUser, requireAuthentication, requireRole, startSession } from "./request";
export { AuthError, authActionFailure, authErrorResponse } from "./errors";
export { safeReturnPath } from "./return-path";
export { hashPassword, verifyPassword } from "./password";
export type { AuthUser } from "./user";
export type { AuthContext } from "./guards";
