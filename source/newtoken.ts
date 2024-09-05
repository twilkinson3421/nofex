import { ControlLabels } from "./controllabels.js";
import { Instructions } from "./instructions.js";
import { TokenSpec, TokenType } from "./tokens.js";

export namespace NewToken {
  export const generic = <T extends TokenType>(
    type: T,
    line: number,
    column: number
  ): TokenSpec.GenericToken<T> => ({ type, line, column });

  export const instruction = <V extends Instructions.Name>(
    value: V,
    line: number,
    column: number
  ): TokenSpec.InstructionToken<V> => ({
    type: TokenType.Instruction,
    value,
    line,
    column,
  });

  export const identifier = <V extends string>(
    value: V,
    line: number,
    column: number
  ): TokenSpec.IdentifierToken<V> => ({
    type: TokenType.Identifier,
    value,
    line,
    column,
  });

  export const controlLabel = <V extends ControlLabels.Name>(
    value: V,
    line: number,
    column: number
  ): TokenSpec.ControlLabelToken<V> => ({
    type: TokenType.ControlLabel,
    value,
    line,
    column,
  });

  export const numericLiteral = <V extends number>(
    value: V,
    line: number,
    column: number
  ): TokenSpec.NumericLiteralToken<V> => ({
    type: TokenType.NumericLiteral,
    value,
    line,
    column,
  });

  export const stringLiteral = <V extends string>(
    value: V,
    line: number,
    column: number
  ): TokenSpec.StringLiteralToken<V> => ({
    type: TokenType.StringLiteral,
    value,
    line,
    column,
  });

  export const registerReference = <V extends string>(
    value: V,
    line: number,
    column: number
  ): TokenSpec.RegisterReferenceToken<V> => ({
    type: TokenType.RegisterReference,
    value,
    line,
    column,
  });

  export const fileReference = <V extends string>(
    value: V,
    line: number,
    column: number
  ): TokenSpec.FileReferenceToken<V> => ({
    type: TokenType.FileReference,
    value,
    line,
    column,
  });

  export const moduleReference = <M extends string, V extends string>(
    module: M,
    value: V,
    line: number,
    column: number
  ): TokenSpec.ModuleReferenceToken<M, V> => ({
    type: TokenType.ModuleReference,
    module,
    value,
    line,
    column,
  });

  export const processArgumentReference = <V extends number>(
    value: V,
    line: number,
    column: number
  ): TokenSpec.ProcessArgumentReferenceToken<V> => ({
    type: TokenType.ProcessArgumentReference,
    value,
    line,
    column,
  });

  export const endOfProcess = (
    line: number,
    column: number
  ): TokenSpec.EndOfProcessToken => ({
    type: TokenType.EndOfProcess,
    line,
    column,
  });
}
