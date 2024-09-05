import { TokenSpec } from "./tokens.js";

export namespace WanderingTokens {
  export function removeLocation({
    line,
    column,
    ...token
  }: TokenSpec.AnyToken): Token {
    return token;
  }

  export type Token = Omit<TokenSpec.AnyToken, "line" | "column">;
}
