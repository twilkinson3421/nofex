import { ControlLabels } from "./controllabels.js";
import { Instructions } from "./instructions.js";

export enum TokenType {
  Instruction = "INSTRUCTION",
  Identifier = "IDENTIFIER",
  ControlLabel = "CONTROL_LABEL",

  NumericLiteral = "NUMERIC_LITERAL",
  StringLiteral = "STRING_LITERAL",

  RegisterReference = "REGISTER_REFERENCE",
  FileReference = "FILE_REFERENCE",
  ModuleReference = "MODULE_REFERENCE",
  ProcessArgumentReference = "ARGUMENT_REFERENCE",

  EndOfProcess = "END_OF_PROCESS",
}

export namespace TokenSpec {
  export interface GenericToken<T extends TokenType> {
    type: T;
    line: number;
    column: number;
  }

  export interface GenericValueToken<T extends TokenType, V extends any>
    extends GenericToken<T> {
    value: V;
  }

  export interface InstructionToken<V extends Instructions.Name>
    extends GenericValueToken<TokenType.Instruction, V> {}

  export interface IdentifierToken<V extends string>
    extends GenericValueToken<TokenType.Identifier, V> {}

  export interface ControlLabelToken<V extends ControlLabels.Name>
    extends GenericValueToken<TokenType.ControlLabel, V> {}

  export interface NumericLiteralToken<V extends number>
    extends GenericValueToken<TokenType.NumericLiteral, V> {}

  export interface StringLiteralToken<V extends string>
    extends GenericValueToken<TokenType.StringLiteral, V> {}

  export interface RegisterReferenceToken<V extends string>
    extends GenericValueToken<TokenType.RegisterReference, V> {}

  export interface FileReferenceToken<V extends string>
    extends GenericValueToken<TokenType.FileReference, V> {}

  export interface ModuleReferenceToken<M extends string, V extends string>
    extends GenericValueToken<TokenType.ModuleReference, V> {
    module: M;
  }

  export interface ProcessArgumentReferenceToken<V extends number>
    extends GenericValueToken<TokenType.ProcessArgumentReference, V> {}

  export interface EndOfProcessToken
    extends GenericToken<TokenType.EndOfProcess> {}

  export type AnyToken =
    | GenericToken<TokenType>
    | InstructionToken<Instructions.Name>
    | IdentifierToken<string>
    | ControlLabelToken<ControlLabels.Name>
    | NumericLiteralToken<number>
    | StringLiteralToken<string>
    | RegisterReferenceToken<string>
    | FileReferenceToken<string>
    | ModuleReferenceToken<string, string>
    | ProcessArgumentReferenceToken<number>
    | EndOfProcessToken;
}
