import { TokenSpec, TokenType } from "./tokens.js";

export namespace NewError {
  export namespace Lexer {
    export const invalidRegisterReference = (
      value: string,
      line: number,
      column: number
    ) =>
      `TokenError: Invalid register reference: "${value}" at position ${line}:${column}`;

    export const invalidProcessArgumentReference = (
      value: string,
      line: number,
      column: number
    ) =>
      `TokenError: Invalid process argument reference: "${value}" at position ${line}:${column}`;

    export const unexpectedCharacterInSource = (
      char: string,
      line: number,
      column: number
    ) =>
      `TokenError: Unexpected character in source: "${char}" at position ${line}:${column}`;
  }

  export namespace Runtime {
    export namespace Execution {
      export const unexpectedTokenType = (
        token: TokenSpec.AnyToken,
        expectedTokenType: TokenType
      ) => {
        const suffix = "value" in token ? `: "${token.value}"` : "";
        return `RuntimeError: Expected token of type ${expectedTokenType} at position ${token.line}:${token.line}, but got ${token.type} instead${suffix}`;
      };

      export const unexpectedTokenTypeWhenExpectingOnOf = (
        token: TokenSpec.AnyToken,
        expectedTokenTypes: TokenType[]
      ) => {
        const suffix = "value" in token ? `: "${token.value}"` : "";
        return `RuntimeError: Expected one of token types ${expectedTokenTypes} at position ${token.line}:${token.line}, but got ${token.type} instead${suffix}`;
      };

      export const undefinedValue = (
        value: string,
        token: TokenSpec.AnyToken
      ) =>
        `RuntimeError: Value referenced by ${token.type}: "${value}" is undefined at position ${token.line}:${token.column}`;

      export const unexpectedStatementType = (token: TokenSpec.AnyToken) => {
        const suffix = "value" in token ? `: "${token.value}"` : "";
        return `RuntimeError: Unexpected statement type encountered: ${token.type} at position ${token.line}:${token.column}${suffix}`;
      };

      export const duplicateLabel = (
        token: TokenSpec.IdentifierToken<string>
      ) =>
        `RuntimeError: Duplicate label "${token.value}" at position ${token.line}:${token.column}`;

      export const noLabelFound = (label: string) =>
        `RuntimeError: No declaration was found in source for label "${label}"`;

      export const arrayOperationNotArray = (token: TokenSpec.AnyToken) => {
        const suffix = "value" in token ? `: "${token.value}"` : "";
        return `RuntimeError: Attempted to perform array operation on non-array value at position ${token.line}:${token.column}${suffix}`;
      };

      export const invalidFunctionArity = (
        token: TokenSpec.NumericLiteralToken<number>
      ) =>
        `RuntimeError: Invalid function arity: "${token.value}" at position ${token.line}:${token.column}`;

      export const noFunctionDeclarationEndFound = (
        token: TokenSpec.IdentifierToken<string>
      ) =>
        `RuntimeError: No function declaration end was found in source for function "${token.value}" defined at position ${token.line}:${token.column}`;

      export const valueIsNotFunction = (token: TokenSpec.AnyToken) => {
        const suffix = "value" in token ? `: "${token.value}"` : "";
        return `RuntimeError: Value is not a function at position ${token.line}:${token.column}${suffix}`;
      };

      export const moduleNotFound = (
        token: TokenSpec.ModuleReferenceToken<string, string>
      ) =>
        `RuntimeError: Module "${token.module}" was not found at position ${token.line}:${token.column}`;

      export const duplicateExport = (
        token: TokenSpec.IdentifierToken<string>
      ) =>
        `RuntimeError: Duplicate export "${token.value}" at position ${token.line}:${token.column}`;

      export const fileDoesNotExist = (
        token: TokenSpec.FileReferenceToken<string>,
        path: string
      ) =>
        `RuntimeError: File "${token.value}" at "${path}" does not exist at position ${token.line}:${token.column}`;
    }
  }
}
