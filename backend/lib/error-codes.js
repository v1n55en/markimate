/**
 * Daftar Standar Kode Error Backend Markimate (PRD F3 Langkah 2)
 * Digunakan sebagai konstanta terpadu di backend/index.js dan backend/lib/*.js
 * Pesan fallback disajikan dalam Bahasa Inggris (EN).
 */

export const ERROR_CODES = {
  // Authentication & Identity
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    status: 401,
    message: 'Invalid email or password.'
  },
  EMAIL_NOT_VERIFIED: {
    code: 'EMAIL_NOT_VERIFIED',
    status: 403,
    message: 'Please verify your email address before signing in.'
  },
  ACCOUNT_LOCKED: {
    code: 'ACCOUNT_LOCKED',
    status: 423,
    message: 'Account is temporarily locked due to too many failed attempts. Please try again later.'
  },
  ACCOUNT_PENDING_DELETION: {
    code: 'ACCOUNT_PENDING_DELETION',
    status: 403,
    message: 'Account is scheduled for deletion. Please cancel deletion first to sign in.'
  },
  PASSWORD_NOT_SET: {
    code: 'PASSWORD_NOT_SET',
    status: 401,
    message: 'This account was registered with Google. Sign in with Google or set a password via Forgot Password.'
  },
  EMAIL_EXISTS: {
    code: 'EMAIL_EXISTS',
    status: 409,
    message: 'An account with this email address already exists.'
  },
  PASSWORD_TOO_SHORT: {
    code: 'PASSWORD_TOO_SHORT',
    status: 400,
    message: 'Password must be at least 10 characters.'
  },
  INVALID_PASSWORD: {
    code: 'INVALID_PASSWORD',
    status: 400,
    message: 'Incorrect password.'
  },
  TERMS_REQUIRED: {
    code: 'TERMS_REQUIRED',
    status: 400,
    message: 'You must agree to the Terms of Service and Privacy Policy.'
  },
  INVALID_EMAIL: {
    code: 'INVALID_EMAIL',
    status: 400,
    message: 'Please provide a valid email address.'
  },
  EMAIL_REQUIRED: {
    code: 'EMAIL_REQUIRED',
    status: 400,
    message: 'Email address is required.'
  },
  EMAIL_SAME: {
    code: 'EMAIL_SAME',
    status: 400,
    message: 'New email address must be different from current email.'
  },
  PARAMS_REQUIRED: {
    code: 'PARAMS_REQUIRED',
    status: 400,
    message: 'Required parameters are missing.'
  },
  INVALID_LOCALE: {
    code: 'INVALID_LOCALE',
    status: 400,
    message: 'Locale must be either id or en.'
  },
  LINK_PASSWORD_REQUIRED: {
    code: 'LINK_PASSWORD_REQUIRED',
    status: 409,
    message: 'An account with this email already exists. Enter your password to link your Google account.'
  },
  LINK_TOKEN_EXPIRED: {
    code: 'LINK_TOKEN_EXPIRED',
    status: 400,
    message: 'Pending account linking token has expired. Please try again.'
  },
  INVALID_PENDING_TOKEN: {
    code: 'INVALID_PENDING_TOKEN',
    status: 400,
    message: 'Invalid or expired pending link token.'
  },
  INVALID_STATE: {
    code: 'INVALID_STATE',
    status: 400,
    message: 'Authentication session expired or state mismatch. Please sign in again.'
  },
  INVALID_CALLBACK_PARAMS: {
    code: 'INVALID_CALLBACK_PARAMS',
    status: 400,
    message: 'Authorization code and state parameters are required.'
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    status: 400,
    message: 'Invalid or expired token.'
  },
  TOKEN_REQUIRED: {
    code: 'TOKEN_REQUIRED',
    status: 400,
    message: 'Token is required.'
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    status: 400,
    message: 'The token has expired.'
  },
  SESSION_EXPIRED: {
    code: 'SESSION_EXPIRED',
    status: 401,
    message: 'Session has expired. Please sign in again.'
  },
  LEGACY_SESSION_EXPIRED: {
    code: 'LEGACY_SESSION_EXPIRED',
    status: 401,
    message: 'Session format is outdated. Please sign in again.'
  },
  TOKEN_REUSE_DETECTED: {
    code: 'TOKEN_REUSE_DETECTED',
    status: 401,
    message: 'Refresh token reuse detected. All sessions have been revoked.'
  },
  NO_REFRESH_TOKEN: {
    code: 'NO_REFRESH_TOKEN',
    status: 401,
    message: 'No refresh token provided.'
  },
  INVALID_REFRESH_TOKEN: {
    code: 'INVALID_REFRESH_TOKEN',
    status: 401,
    message: 'Invalid or expired refresh token.'
  },
  INVALID_SESSION: {
    code: 'INVALID_SESSION',
    status: 401,
    message: 'Invalid or expired session.'
  },
  SESSION_NOT_FOUND: {
    code: 'SESSION_NOT_FOUND',
    status: 404,
    message: 'Session not found.'
  },
  ACCOUNT_INACTIVE: {
    code: 'ACCOUNT_INACTIVE',
    status: 401,
    message: 'Account not found or inactive.'
  },
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    status: 404,
    message: 'User not found.'
  },
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    status: 401,
    message: 'Authentication required.'
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    status: 403,
    message: 'Access denied.'
  },
  BAD_REQUEST: {
    code: 'BAD_REQUEST',
    status: 400,
    message: 'Bad request.'
  },

  // Workspace & Access Control
  WORKSPACE_NOT_FOUND: {
    code: 'WORKSPACE_NOT_FOUND',
    status: 404,
    message: 'Workspace not found or access denied.'
  },
  WORKSPACE_REQUIRED: {
    code: 'WORKSPACE_REQUIRED',
    status: 403,
    message: 'Workspace is required.'
  },
  WORKSPACE_LIMIT_REACHED: {
    code: 'WORKSPACE_LIMIT_REACHED',
    status: 403,
    message: 'Maximum workspace limit reached. Please upgrade to add more workspaces.'
  },
  NAME_REQUIRED: {
    code: 'NAME_REQUIRED',
    status: 400,
    message: 'Workspace name is required.'
  },
  CANNOT_DELETE_LAST_WORKSPACE: {
    code: 'CANNOT_DELETE_LAST_WORKSPACE',
    status: 400,
    message: 'You cannot delete your only workspace.'
  },
  FORBIDDEN_ROLE: {
    code: 'FORBIDDEN_ROLE',
    status: 403,
    message: 'You do not have permission to perform this action in this workspace.'
  },
  INVALID_ROLE: {
    code: 'INVALID_ROLE',
    status: 400,
    message: 'Role must be admin or viewer.'
  },
  CANNOT_DEMOTE_OWNER: {
    code: 'CANNOT_DEMOTE_OWNER',
    status: 400,
    message: 'The workspace owner cannot be demoted. Please transfer ownership instead.'
  },
  TRANSFER_OWNERSHIP_FIRST: {
    code: 'TRANSFER_OWNERSHIP_FIRST',
    status: 409,
    message: 'You must transfer workspace ownership before deleting your account or leaving.'
  },
  ALREADY_OWNER: {
    code: 'ALREADY_OWNER',
    status: 400,
    message: 'You are already the owner of this workspace.'
  },
  EMAIL_MISMATCH: {
    code: 'EMAIL_MISMATCH',
    status: 403,
    message: 'This invitation was sent to a different email address.'
  },
  ALREADY_MEMBER: {
    code: 'ALREADY_MEMBER',
    status: 409,
    message: 'User is already a member of this workspace.'
  },
  MAX_INVITES_REACHED: {
    code: 'MAX_INVITES_REACHED',
    status: 400,
    message: 'Maximum active invitation limit reached for this workspace.'
  },
  INVITE_NOT_FOUND: {
    code: 'INVITE_NOT_FOUND',
    status: 404,
    message: 'Invitation not found or has expired.'
  },
  CONFIRM_MISMATCH: {
    code: 'CONFIRM_MISMATCH',
    status: 400,
    message: 'Confirmation phrase mismatch.'
  },

  // Module Entitlements, Credits & Billing
  MODULE_INACTIVE: {
    code: 'MODULE_INACTIVE',
    status: 403,
    message: 'This module is not active for the current workspace subscription.'
  },
  MODULE_NOT_AVAILABLE: {
    code: 'MODULE_NOT_AVAILABLE',
    status: 404,
    message: 'This module is not yet available.'
  },
  INSUFFICIENT_CREDITS: {
    code: 'INSUFFICIENT_CREDITS',
    status: 402,
    message: 'Insufficient credits to perform this action. Please top up your wallet.'
  },
  DAILY_CAP: {
    code: 'DAILY_CAP',
    status: 429,
    message: 'Daily credit limit reached. Please try again tomorrow or contact support.'
  },
  BILLING_DISABLED: {
    code: 'BILLING_DISABLED',
    status: 403,
    message: 'Direct payment is currently unavailable. Please contact support.'
  },
  UPGRADE_REQUIRED: {
    code: 'UPGRADE_REQUIRED',
    status: 402,
    message: 'This feature requires a paid subscription. Please upgrade your plan.'
  },
  PAYMENT_GATEWAY_REJECTED: {
    code: 'PAYMENT_GATEWAY_REJECTED',
    status: 502,
    message: 'Payment gateway rejected the request. Please try again or contact support.'
  },
  MODULE_ALREADY_OWNED: {
    code: 'MODULE_ALREADY_OWNED',
    status: 409,
    message: 'Workspace already owns this lifetime module.'
  },
  INVALID_MODULE: {
    code: 'INVALID_MODULE',
    status: 400,
    message: 'Invalid module or bundle.'
  },
  INVALID_TOPUP_AMOUNT: {
    code: 'INVALID_TOPUP_AMOUNT',
    status: 400,
    message: 'Top-up credits must be between 50 and 50,000.'
  },
  PLAN_DISCONTINUED: {
    code: 'PLAN_DISCONTINUED',
    status: 410,
    message: 'Monthly subscription plans have been discontinued. Please choose a lifetime module.'
  },

  // SEO & CMS
  UNSUPPORTED_CMS: {
    code: 'UNSUPPORTED_CMS',
    status: 400,
    message: 'Unsupported CMS type.'
  },
  CMS_NOT_CONFIGURED: {
    code: 'CMS_NOT_CONFIGURED',
    status: 400,
    message: 'CMS credentials have not been configured yet.'
  },
  KEYWORD_REQUIRED: {
    code: 'KEYWORD_REQUIRED',
    status: 400,
    message: 'Keyword is required.'
  },

  // Platform & Security
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    status: 429,
    message: 'Too many requests. Please wait a moment and try again.'
  },
  INVALID_SIGNATURE: {
    code: 'INVALID_SIGNATURE',
    status: 400,
    message: 'Invalid request signature.'
  },
  SIGNED_REQUEST_REQUIRED: {
    code: 'SIGNED_REQUEST_REQUIRED',
    status: 400,
    message: 'signed_request parameter is required.'
  },
  CODE_REQUIRED: {
    code: 'CODE_REQUIRED',
    status: 400,
    message: 'Confirmation code is required.'
  },
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    status: 503,
    message: 'Service is temporarily unavailable.'
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    status: 400,
    message: 'Validation failed.'
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    status: 404,
    message: 'Resource not found.'
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    status: 500,
    message: 'An internal server error occurred.'
  },
  INVALID_TONE: {
    code: 'INVALID_TONE',
    status: 400,
    message: 'Custom writing tone contains invalid characters or exceeds limit.'
  },
  SEO_IMAGE_REGEN_DISABLED: {
    code: 'SEO_IMAGE_REGEN_DISABLED',
    status: 400,
    message: 'Image regeneration feature is currently disabled.'
  },
  INVALID_IMAGE_INDEX: {
    code: 'INVALID_IMAGE_INDEX',
    status: 400,
    message: 'Invalid image index provided.'
  },
  IMAGE_GENERATION_FAILED: {
    code: 'IMAGE_GENERATION_FAILED',
    status: 502,
    message: 'Failed to generate image from AI model.'
  },
  GENERATE_TIMEOUT: {
    code: 'GENERATE_TIMEOUT',
    status: 504,
    message: 'Article generation timed out (exceeded 10 minutes).'
  }
};

/**
 * Helper untuk membuat respons error terstandarisasi
 * @param {import('express').Response} res
 * @param {keyof typeof ERROR_CODES} codeKey
 * @param {string} [customMessage]
 * @param {object} [extraData]
 */
export function sendError(res, codeKey, customMessage, extraData = {}) {
  const errDef = ERROR_CODES[codeKey] || ERROR_CODES.INTERNAL_ERROR;
  return res.status(errDef.status).json({
    code: errDef.code,
    error: customMessage || errDef.message,
    ...extraData
  });
}
