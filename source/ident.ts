export namespace TryIdent {
  export const isAlpha = (input: string) => /^[a-zA-Z]+$/.test(input);
  export const isNumeric = (input: string) => /^[0-9\-]+$/.test(input);
  export const isAlphaNumeric = (input: string) => /^[a-zA-Z0-9]+$/.test(input);

  export const isNumericOrDecimal = (input: string) => /^[0-9.]+$/.test(input);

  export const isValidIdentInitial = (input: string) =>
    isAlpha(input) || /[_\$]/.test(input);
  export const isValidIdentNoninitial = (input: string) =>
    isAlphaNumeric(input) || /[_\$]/.test(input);
}
