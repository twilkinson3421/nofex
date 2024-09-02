import { OperationName } from "./operations.js";
import { RegisterName } from "./registers.js";

export enum TokenType {
  EndOfFile,

  Operation,
  Identifier,

  NumericLiteral,
  StringLiteral,

  Comment,

  RegisterRef,
  FunctionArgumentRef,
}

export interface Token<T extends TokenType, D extends string> {
  type: T;
  debug: D;
}

export interface EOFToken extends Token<TokenType.EndOfFile, "EOF"> {
  type: TokenType.EndOfFile;
  debug: "EOF";
}

export interface OperationToken<V extends OperationName>
  extends Token<TokenType.Operation, "OPERATION"> {
  type: TokenType.Operation;
  debug: "OPERATION";
  value: V;
}

export interface IdentToken<V extends string>
  extends Token<TokenType.Identifier, "IDENTIFIER"> {
  type: TokenType.Identifier;
  debug: "IDENTIFIER";
  value: V;
}

export interface NumericLiteralToken<V extends number>
  extends Token<TokenType.NumericLiteral, "NUMERIC_LITERAL"> {
  type: TokenType.NumericLiteral;
  debug: "NUMERIC_LITERAL";
  value: V;
}

export interface StringLiteralToken<V extends string>
  extends Token<TokenType.StringLiteral, "STRING_LITERAL"> {
  type: TokenType.StringLiteral;
  debug: "STRING_LITERAL";
  value: V;
}

export interface CommentToken<V extends string>
  extends Token<TokenType.Comment, "COMMENT"> {
  type: TokenType.Comment;
  debug: "COMMENT";
  value: V;
}

export interface RegisterRefToken<V extends RegisterName>
  extends Token<TokenType.RegisterRef, "REGISTER_REF"> {
  type: TokenType.RegisterRef;
  debug: "REGISTER_REF";
  value: V;
}

export interface FunctionArgumentRefToken<V extends number>
  extends Token<TokenType.FunctionArgumentRef, "FUNCTION_ARGUMENT_REF"> {
  type: TokenType.FunctionArgumentRef;
  debug: "FUNCTION_ARGUMENT_REF";
  value: V;
}

export type LexedToken =
  | Token<TokenType, string>
  | EOFToken
  | OperationToken<OperationName>
  | IdentToken<string>
  | NumericLiteralToken<number>
  | StringLiteralToken<string>
  | CommentToken<string>;

export function getDebugFromType(type: TokenType): string {
  switch (type) {
    case TokenType.EndOfFile:
      return "EOF";
    case TokenType.Operation:
      return "OPERATION";
    case TokenType.Identifier:
      return "IDENTIFIER";
    case TokenType.NumericLiteral:
      return "NUMERIC_LITERAL";
    case TokenType.StringLiteral:
      return "STRING_LITERAL";
    case TokenType.Comment:
      return "COMMENT";
    case TokenType.RegisterRef:
      return "REGISTER_REF";
    case TokenType.FunctionArgumentRef:
      return "FUNCTION_ARGUMENT_REF";
  }
}

export namespace InitToken {
  export const generic = <T extends TokenType, D extends string>(
    type: T,
    debug: D
  ): Token<T, D> => ({
    type,
    debug,
  });

  export const eof = (): EOFToken => ({
    type: TokenType.EndOfFile,
    debug: "EOF",
  });

  export const operation = <V extends OperationName>(
    value: V
  ): OperationToken<V> => ({
    type: TokenType.Operation,
    debug: "OPERATION",
    value,
  });

  export const ident = <V extends string>(value: V): IdentToken<V> => ({
    type: TokenType.Identifier,
    debug: "IDENTIFIER",
    value,
  });

  export const numericLiteral = <V extends number>(
    value: V
  ): NumericLiteralToken<V> => ({
    type: TokenType.NumericLiteral,
    debug: "NUMERIC_LITERAL",
    value,
  });

  export const stringLiteral = <V extends string>(
    value: V
  ): StringLiteralToken<V> => ({
    type: TokenType.StringLiteral,
    debug: "STRING_LITERAL",
    value,
  });

  export const comment = <V extends string>(value: V): CommentToken<V> => ({
    type: TokenType.Comment,
    debug: "COMMENT",
    value,
  });

  export const registerRef = <V extends RegisterName>(
    value: V
  ): RegisterRefToken<V> => ({
    type: TokenType.RegisterRef,
    debug: "REGISTER_REF",
    value,
  });

  export const functionArgumentRef = <V extends number>(
    value: V
  ): FunctionArgumentRefToken<V> => ({
    type: TokenType.FunctionArgumentRef,
    debug: "FUNCTION_ARGUMENT_REF",
    value,
  });
}
