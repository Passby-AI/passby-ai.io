/** Shared URL validation without importing the build-time content schema in browsers. */
export function validateSlug(value: string): string {
  if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(value)) {
    throw new Error(`Invalid slug "${value}": use a single segment of letters, numbers, hyphens or underscores`);
  }
  return value;
}
