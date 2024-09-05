export namespace Environment {
  export const init = () =>
    new Map<string, any>([
      ["$NULL", null],
      ["$TRUE", true],
      ["$FALSE", false],
      ["$ARRAY", []],
    ]);
}
