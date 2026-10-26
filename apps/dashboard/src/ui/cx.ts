/** Join class names, skipping falsy values (the web uses `classnames` / `cn`). */
export const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(" ");
