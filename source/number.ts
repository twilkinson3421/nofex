export namespace TryNumber {
  export const isPositiveSafeFiniteInteger = (value: number) =>
    Number.isFinite(value) && Number.isSafeInteger(value) && value >= 0;
}
