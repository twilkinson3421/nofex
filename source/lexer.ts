import { characters } from "./characters.js";
import { debug } from "./debug.js";
import { TryIdent } from "./ident.js";
import { canIgnore } from "./ignore.js";
import { OperationName, operations } from "./operations.js";
import { RegisterName, initRegisters } from "./registers.js";
import { InitToken, LexedToken } from "./tokens.js";

export function lex(source: string): LexedToken[] {
  const tokens: LexedToken[] = [];
  const sourceArray = source.split("");

  while (sourceArray.length > 0) {
    const char = sourceArray.shift()!;
    const nthChar = (n: number) => sourceArray[n];
    const nChars = (n: number) => sourceArray.slice(0, n);

    const getCharsUntil = (
      until: string,
      options?: { ignoreIfPrevious?: string }
    ) => {
      const chars: string[] = [];
      let ignore = false;

      while (
        sourceArray.length > 0 &&
        (nChars(until.length).join("") !== until || ignore)
      ) {
        if (options?.ignoreIfPrevious === nthChar(0)) ignore = true;
        else ignore = false;
        chars.push(sourceArray.shift()!);
      }

      return chars;
    };

    const shiftNChars = (n: number) => {
      while (sourceArray.length > 0 && n > 0) {
        sourceArray.shift();
        n--;
      }
    };

    if (char === characters.comment_start) {
      const value = getCharsUntil(characters.newline).join("").trim();
      tokens.push(InitToken.comment(value));
      continue;
    }

    if (char === characters.string_delimiter) {
      const value = getCharsUntil(characters.string_delimiter, {
        ignoreIfPrevious: characters.escape_character,
      }).join("");
      shiftNChars(1); // end of string delimiter
      tokens.push(InitToken.stringLiteral(value));
      continue;
    }

    if (char === characters.register_reference) {
      let value = "";
      while (sourceArray.length > 0 && TryIdent.isValidIdent(nthChar(0))) {
        value += sourceArray.shift();
      }

      if (!initRegisters().has(value as RegisterName)) {
        console.error(
          `Encountered invalid register reference: "${value}" at position ${
            source.length - sourceArray.length
          }`
        );
        process.exit(1);
      } else tokens.push(InitToken.registerRef(value as RegisterName));
      continue;
    }

    if (char === characters.function_argument_reference) {
      let value: string | number = "";
      while (sourceArray.length > 0 && TryIdent.isNumeric(nthChar(0))) {
        value += sourceArray.shift();
      }
      value = Number(value);

      if (
        value < 0 ||
        Number.isNaN(value) ||
        !Number.isInteger(value) ||
        !Number.isFinite(value) ||
        !Number.isSafeInteger(value)
      ) {
        console.error(
          `Encountered invalid function argument reference: "${value}" at position ${
            source.length - sourceArray.length
          }`
        );
        process.exit(1);
      }

      tokens.push(InitToken.functionArgumentRef(value));
      continue;
    }

    if (TryIdent.isValidIdentInitial(char)) {
      let value = char;
      while (sourceArray.length > 0 && TryIdent.isValidIdent(nthChar(0))) {
        value += sourceArray.shift();
      }

      if (operations.has(value.toLowerCase() as string as any)) {
        tokens.push(InitToken.operation(value.toLowerCase() as OperationName));
        continue;
      }

      tokens.push(InitToken.ident(value));
      continue;
    }

    if (TryIdent.isNumeric(char)) {
      let value = char;
      while (
        sourceArray.length > 0 &&
        TryIdent.isNumericOrDecimal(nthChar(0))
      ) {
        value += sourceArray.shift();
      }

      tokens.push(InitToken.numericLiteral(Number(value)));
      continue;
    }

    if (canIgnore(char)) continue;

    console.log(tokens.slice(-debug.logNTokensWhenError));
    console.error(
      `Encountered unexpected character at position ${
        source.length - sourceArray.length
      }: "${char}". The previous ${
        debug.logNTokensWhenError
      } tokens are shown above`
    );
    process.exit(1);
  }

  tokens.push(InitToken.eof());
  return tokens;
}
