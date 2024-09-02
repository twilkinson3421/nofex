export const ignore = new Set<string>([" ", "\n", "\t", "\r", "\0", "\x0B"]);
export const canIgnore = (input: string) => ignore.has(input);
