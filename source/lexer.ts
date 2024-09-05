import { characters } from "./characters.js";
import { ControlLabels } from "./controllabels.js";
import { NewError } from "./errors.js";
import { TryIdent } from "./ident.js";
import { canIgnoreChar } from "./ignore.js";
import { Instructions } from "./instructions.js";
import { NewToken } from "./newtoken.js";
import { TryNumber } from "./number.js";
import { Registers } from "./registers.js";
import { TokenSpec } from "./tokens.js";

export function lex(source: string): TokenSpec.AnyToken[] {
  const tokens: TokenSpec.AnyToken[] = [];
  const sourceArray = source.split("");

  let line = 1;
  let column = 0;

  while (sourceArray.length > 0) {
    function handleNextPosition(char: string) {
      if (char === characters.newline) {
        line++;
        column = 0;
      } else column++;
    }

    function shiftChar() {
      const char = sourceArray.shift()!;
      handleNextPosition(char);
      return char;
    }

    const char = shiftChar();
    const tokenStartColumn = column;

    const peekNthChar = (n: number) => sourceArray[n];
    const peekNChars = (n: number) => sourceArray.slice(0, n);

    function getCharsAndShiftUntil(
      match: string,
      options?: { ignoreIfSucceeds?: string }
    ) {
      const chars: string[] = [];
      let ignore = false;

      while (
        sourceArray.length > 0 &&
        (peekNChars(match.length).join("") !== match || ignore)
      ) {
        if (options?.ignoreIfSucceeds === peekNthChar(0)) ignore = true;
        else ignore = false;
        chars.push(shiftChar());
      }

      return chars;
    }

    function shiftNChars(n: number) {
      while (sourceArray.length > 0 && n > 0) {
        shiftChar();
        n--;
      }
    }

    if (char === characters.commentStart) {
      getCharsAndShiftUntil(characters.newline);
      continue;
    }

    if (char === characters.stringDelimiter) {
      const value = getCharsAndShiftUntil(characters.stringDelimiter, {
        ignoreIfSucceeds: characters.escapeCharacter,
      }).join("");
      shiftNChars(1); // end of string delimiter
      tokens.push(NewToken.stringLiteral(value, line, tokenStartColumn));
      continue;
    }

    if (char === characters.registerReference) {
      let value: string = "";
      while (
        sourceArray.length > 0 &&
        TryIdent.isValidIdentNoninitial(peekNthChar(0))
      ) {
        value += shiftChar();
      }

      const isValidRegister = Registers.init().has(value as Registers.Name);

      if (!isValidRegister) {
        throw new Error(
          NewError.Lexer.invalidRegisterReference(value, line, tokenStartColumn)
        );
      }

      tokens.push(NewToken.registerReference(value, line, tokenStartColumn));
      continue;
    }

    if (char === characters.processArgumentReference) {
      let value: string | number = "";
      while (sourceArray.length > 0 && TryIdent.isNumeric(peekNthChar(0))) {
        value += shiftChar();
      }
      value = Number(value);

      if (!TryNumber.isPositiveSafeFiniteInteger(value)) {
        throw new Error(
          NewError.Lexer.invalidProcessArgumentReference(
            value.toString(),
            line,
            tokenStartColumn
          )
        );
      }

      tokens.push(
        NewToken.processArgumentReference(value, line, tokenStartColumn)
      );
      continue;
    }

    if (char === characters.fileReferenceDelimiterStart) {
      const value = getCharsAndShiftUntil(
        characters.fileReferenceDelimiterEnd
      ).join("");
      shiftNChars(1); // end of file reference delimiter
      tokens.push(NewToken.fileReference(value, line, tokenStartColumn));
      continue;
    }

    if (char === characters.moduleReferenceDelimiterStart) {
      const module = getCharsAndShiftUntil(
        characters.moduleReferenceSeparator
      ).join("");
      shiftNChars(1); // module reference separator

      let value: string = "";
      while (
        sourceArray.length > 0 &&
        TryIdent.isValidIdentNoninitial(peekNthChar(0))
      ) {
        value += shiftChar();
      }
      tokens.push(
        NewToken.moduleReference(module, value, line, tokenStartColumn)
      );
      continue;
    }

    if (TryIdent.isValidIdentInitial(char)) {
      let value: string = char;
      while (
        sourceArray.length > 0 &&
        TryIdent.isValidIdentNoninitial(peekNthChar(0))
      ) {
        value += shiftChar();
      }

      const isValidInstruction = Instructions.all.has(
        value.toLowerCase() as Instructions.Name
      );

      const isValidControlLabel = ControlLabels.all.has(
        value.toLowerCase() as ControlLabels.Name
      );

      if (isValidInstruction) {
        tokens.push(
          NewToken.instruction(
            value.toLowerCase() as Instructions.Name,
            line,
            tokenStartColumn
          )
        );
        continue;
      }

      if (isValidControlLabel) {
        tokens.push(
          NewToken.controlLabel(
            value.toLowerCase() as ControlLabels.Name,
            line,
            tokenStartColumn
          )
        );
        continue;
      }

      tokens.push(NewToken.identifier(value, line, tokenStartColumn));
      continue;
    }

    if (TryIdent.isNumeric(char)) {
      let value: string = char;

      while (
        sourceArray.length > 0 &&
        TryIdent.isNumericOrDecimal(peekNthChar(0))
      ) {
        value += shiftChar();
      }

      tokens.push(
        NewToken.numericLiteral(Number(value), line, tokenStartColumn)
      );
      continue;
    }

    if (canIgnoreChar(char)) continue;

    throw new Error(
      NewError.Lexer.unexpectedCharacterInSource(char, line, tokenStartColumn)
    );
  }

  tokens.push(NewToken.endOfProcess(line, column));
  return tokens;
}
