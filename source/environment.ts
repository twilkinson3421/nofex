export const initEnvironment = () =>
  new Map<string, any>([
    ["$NULL", null],
    ["$TRUE", true],
    ["$FALSE", false],
    ["$ARRAY", []],
  ]);
