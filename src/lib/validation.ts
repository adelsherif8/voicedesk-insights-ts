import type { Context } from 'hono';
import type { ZodError } from 'zod';

export function validationError(c: Context, error: ZodError) {
  return c.json(
    {
      error: 'validation_failed',
      issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    },
    400,
  );
}

/** Shared hook for @hono/zod-validator: turn a failed parse into a 400 with readable issues. */
export const onInvalid = (result: { success: boolean; error?: unknown }, c: Context) => {
  if (!result.success) return validationError(c, result.error as ZodError);
  return undefined;
};
