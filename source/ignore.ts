// prettier-ignore
export const ignoreChars = new Set<string>([" ", "\n", "\t", "\r", "\0", "\x0B"]);
export const canIgnoreChar = (char: string) => ignoreChars.has(char);
