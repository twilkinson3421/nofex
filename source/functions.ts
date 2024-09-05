import { TryNumber } from "./number.js";
import { TokenSpec } from "./tokens.js";

export type FunctionInEnvironment = {
  functionBody: TokenSpec.AnyToken[];
  arity: number;
};

export function isValidFunction(value: any): value is FunctionInEnvironment {
  if (typeof value !== "object") return false;
  if (!("functionBody" in value)) return false;
  if (!("arity" in value)) return false;
  if (!Array.isArray(value.functionBody)) return false;
  if (!TryNumber.isPositiveSafeFiniteInteger(value.arity)) return false;
  return true;
}
