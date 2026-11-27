/**
 * Tools that may be shown on screen.
 * A tool event not on the list is ignored. The model's inner thought is not a tool.
 * The real list is decided together with the backend. New tools are added here.
 */
export const ALLOWED_TOOLS = [
  'orders.read',
  'payments.read',
  'shipments.read',
  'stock.read',
  'report.build',
  'notify.draft',
  'rule.draft',
  'action.receive',
] as const;

export type AllowedTool = (typeof ALLOWED_TOOLS)[number];

export function isAllowedTool(value: unknown): value is AllowedTool {
  return typeof value === 'string' && (ALLOWED_TOOLS as readonly string[]).includes(value);
}
