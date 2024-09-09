import * as fs from "fs";
import * as path from "path";
import * as readlineSync from "readline-sync";
import { unraw } from "unraw";

import { ControlLabels } from "./controllabels.js";
import { Environment } from "./environment.js";
import { NewError } from "./errors.js";
import { FunctionInEnvironment, isValidFunction } from "./functions.js";
import { Instructions } from "./instructions.js";
import { lex } from "./lexer.js";
import { Modules } from "./modules.js";
import { NewToken } from "./newtoken.js";
import { TryNumber } from "./number.js";
import { Registers } from "./registers.js";
import { TokenSpec, TokenType } from "./tokens.js";
import { WanderingTokens } from "./wanderingtokens.js";

type RuntimeConstructorOptions = {
  environment?: Map<string, any>;
  registers?: Map<Registers.Name, any>;
};

export class Runtime {
  private tokens: TokenSpec.AnyToken[] = [];

  public environment = Environment.init();
  public registers = Registers.init();
  public modules = Modules.init();
  public exports = Modules.Exports.init();

  private labels: Set<string> = new Set();

  constructor(options?: RuntimeConstructorOptions) {
    if (options?.environment) this.environment = options.environment;
    if (options?.registers) this.registers = options.registers;
  }

  private peekNextToken(): TokenSpec.AnyToken {
    return this.tokens[this.registers.get(Registers.names.positionCounter)];
  }

  private peekNthToken(index: number) {
    return this.tokens[index];
  }

  private peekNthTokenRelative(index: number): TokenSpec.AnyToken {
    return this.tokens[
      this.registers.get(Registers.names.positionCounter) + index
    ];
  }

  private peekNextNTokens(n: number): TokenSpec.AnyToken[] {
    return this.tokens.slice(
      this.registers.get(Registers.names.positionCounter),
      this.registers.get(Registers.names.positionCounter) + n
    );
  }

  private peekTokensInRange(start: number, end: number): TokenSpec.AnyToken[] {
    return this.tokens.slice(start, end);
  }

  private peekTokensUntilTokenArray(tokenArray: WanderingTokens.Token[]) {
    let index = this.getCurrentPosition();
    const tokens: TokenSpec.AnyToken[] = [];

    while (true) {
      const inspectTokens = this.peekTokensInRange(
        index,
        index + tokenArray.length
      ).map(WanderingTokens.removeLocation);

      if (
        inspectTokens.includes(
          WanderingTokens.removeLocation(NewToken.endOfProcess(0, 0))
        )
      )
        break;

      if (JSON.stringify(inspectTokens) === JSON.stringify(tokenArray))
        return tokens;

      tokens.push(this.peekNthToken(index));
      index++;
    }

    return null;
  }

  private eatNextToken<T extends TokenSpec.AnyToken>(): T {
    const token = this.peekNextToken();
    this.incrementPosition();
    return token as T;
  }

  private expectNextToken<T extends TokenSpec.AnyToken>(
    expectedTokenType: TokenType
  ) {
    const token = this.peekNextToken();
    if (token.type !== expectedTokenType)
      throw new Error(
        NewError.Runtime.Execution.unexpectedTokenType(token, expectedTokenType)
      );
    return token as T;
  }

  private eatAndExpectToken<T extends TokenSpec.AnyToken>(
    expectedTokenType: TokenType
  ) {
    this.expectNextToken(expectedTokenType);
    const token = this.eatNextToken<T>();
    return token;
  }

  private eatAndExpectOneOfToken<T extends TokenSpec.AnyToken>(
    expectedTokenTypes: TokenType[]
  ) {
    const token = this.eatNextToken<T>();
    if (!expectedTokenTypes.includes(token.type))
      throw new Error(
        NewError.Runtime.Execution.unexpectedTokenTypeWhenExpectingOnOf(
          token,
          expectedTokenTypes
        )
      );

    return token;
  }

  private eatAndExpectValueCarrierToken() {
    return this.eatAndExpectOneOfToken<
      | TokenSpec.StringLiteralToken<string>
      | TokenSpec.NumericLiteralToken<number>
      | TokenSpec.IdentifierToken<string>
      | TokenSpec.RegisterReferenceToken<Registers.Name>
      | TokenSpec.ProcessArgumentReferenceToken<number>
      | TokenSpec.ModuleReferenceToken<string, string>
    >([
      TokenType.StringLiteral,
      TokenType.NumericLiteral,
      TokenType.Identifier,
      TokenType.RegisterReference,
      TokenType.ProcessArgumentReference,
      TokenType.ModuleReference,
    ]);
  }

  private eatAndExpectValueFromCarrierToken() {
    const token = this.eatAndExpectValueCarrierToken();
    let value;

    switch (token.type) {
      case TokenType.Identifier:
        value = this.environment.get(token.value);
        break;
      case TokenType.RegisterReference:
        value = this.registers.get(token.value);
        break;
      case TokenType.ProcessArgumentReference:
        value = this.registers
          .get(Registers.names.processArguments)
          .at(token.value);
        break;
      case TokenType.ModuleReference:
        value = this.modules.get(token.module)?.exports.get(token.value);
        break;
      default:
        value = token.value;
        break;
    }

    if (typeof value === "undefined")
      throw new Error(
        NewError.Runtime.Execution.undefinedValue(token.value.toString(), token)
      );

    return value;
  }

  private eatIdentifierNameFromNextToken() {
    const value = this.eatAndExpectToken<TokenSpec.IdentifierToken<string>>(
      TokenType.Identifier
    ).value;
    return value;
  }

  private getCurrentPosition() {
    return this.registers.get(Registers.names.positionCounter);
  }

  private setPosition(n: number) {
    this.modifyRegister(Registers.names.positionCounter, n);
  }

  private incrementPosition() {
    this.setPosition(this.getCurrentPosition() + 1);
  }

  private modifyRegister(register: Registers.Name, value: any) {
    switch (register) {
      case Registers.names.positionCounter:
        this.registers.set(
          Registers.names.positionBeforeBranch,
          this.getCurrentPosition()
        );
        this.registers.set(register, value);
        break;
      case Registers.names.accumulator:
        this.registers.set(
          Registers.names.previousAccumulator,
          this.registers.get(Registers.names.accumulator)
        );
        this.registers.set(register, value);
        break;
      case Registers.names.complexDataRegister1:
      case Registers.names.complexDataRegister2:
      case Registers.names.complexDataRegister3:
      case Registers.names.complexDataRegister4:
      case Registers.names.complexDataRegister5:
      case Registers.names.complexDataRegister6:
      case Registers.names.complexDataRegister7:
      case Registers.names.complexDataRegister8:
        this.registers.set(
          Registers.names.complexOverwrittenRegister,
          this.registers.get(register)
        );
        this.registers.set(register, value);
        break;
      default:
        this.registers.set(register, value);
        break;
    }
  }

  private modifyEnvironment(ident: string, value: any) {
    this.environment.set(ident, value);
  }

  //* Process Flow

  private getPositionOfTokenArray(tokenArray: WanderingTokens.Token[]) {
    let index = 0;

    while (true) {
      const tokens = this.peekTokensInRange(
        index,
        index + tokenArray.length
      ).map(WanderingTokens.removeLocation);

      if (
        tokens.includes(
          WanderingTokens.removeLocation(NewToken.endOfProcess(0, 0))
        )
      )
        break;

      if (JSON.stringify(tokens) === JSON.stringify(tokenArray)) return index;
      index++;
    }

    return -1;
  }

  private goToLabel(label: string) {
    const targetTokenArray = [
      NewToken.controlLabel(ControlLabels.names.label, 0, 0),
      NewToken.identifier(label, 0, 0),
    ].map(WanderingTokens.removeLocation);

    const index = this.getPositionOfTokenArray(targetTokenArray);

    if (index < 0)
      throw new Error(NewError.Runtime.Execution.noLabelFound(label));

    this.setPosition(index);
  }

  //* Instructions
  //& Variables

  private instruction$setVariable() {
    const ident = this.eatIdentifierNameFromNextToken();
    const value = this.eatAndExpectValueFromCarrierToken();
    this.modifyEnvironment(ident, value);
  }

  private instruction$loadVariable() {
    this.expectNextToken(TokenType.Identifier);
    const value = this.eatAndExpectValueFromCarrierToken();
    this.modifyRegister(Registers.names.complexDataRegister1, value);
  }

  //& Logical Operations

  private instruction$compare() {
    const comparisonWith = this.eatAndExpectValueFromCarrierToken();
    const comparisonSubject = this.eatAndExpectValueFromCarrierToken();

    if (comparisonSubject > comparisonWith)
      this.modifyRegister(Registers.names.accumulator, 1);
    else if (comparisonSubject < comparisonWith)
      this.modifyRegister(Registers.names.accumulator, -1);
    else this.modifyRegister(Registers.names.accumulator, 0);
  }

  private instruction$branchAlways() {
    const label = this.eatIdentifierNameFromNextToken();
    this.goToLabel(label);
  }

  private instruction$branchIfGreaterThan() {
    if (this.registers.get(Registers.names.accumulator) === 1)
      this.instruction$branchAlways();
    else this.eatAndExpectToken(TokenType.Identifier);
  }

  private instruction$branchIfLessThan() {
    if (this.registers.get(Registers.names.accumulator) === -1)
      this.instruction$branchAlways();
    else this.eatAndExpectToken(TokenType.Identifier);
  }

  private instruction$branchIfEqualTo() {
    if (this.registers.get(Registers.names.accumulator) === 0)
      this.instruction$branchAlways();
    else this.eatAndExpectToken(TokenType.Identifier);
  }

  private instruction$branchIfNotEqualTo() {
    if (this.registers.get(Registers.names.accumulator) !== 0)
      this.instruction$branchAlways();
    else this.eatAndExpectToken(TokenType.Identifier);
  }

  private instruction$branchIfZero() {
    if (this.registers.get(Registers.names.accumulator) === 0)
      this.instruction$branchAlways();
    else this.eatAndExpectToken(TokenType.Identifier);
  }

  private instruction$branchIfPositive() {
    if (this.registers.get(Registers.names.accumulator) > 0)
      this.instruction$branchAlways();
    else this.eatAndExpectToken(TokenType.Identifier);
  }

  private instruction$branchIfNegative() {
    if (this.registers.get(Registers.names.accumulator) < 0)
      this.instruction$branchAlways();
    else this.eatAndExpectToken(TokenType.Identifier);
  }

  //& Input/Output

  private parseConsoleOutput(message: any) {
    return unraw(message.toString());
  }

  private instruction$writeLine() {
    const message = this.eatAndExpectValueFromCarrierToken();
    process.stdout.write(`${this.parseConsoleOutput(message)}\n`);
  }

  private instruction$standardOutput() {
    const message = this.eatAndExpectValueFromCarrierToken();
    process.stdout.write(this.parseConsoleOutput(message));
  }

  private instruction$standardError() {
    const message = this.eatAndExpectValueFromCarrierToken();
    process.stderr.write(this.parseConsoleOutput(message));
  }

  private instruction$standardInput() {
    const prompt = this.eatAndExpectValueFromCarrierToken();

    const input = readlineSync.question(this.parseConsoleOutput(prompt));
    this.modifyRegister(Registers.names.complexDataRegister1, input);
  }

  private instruction$newLine() {
    process.stdout.write("\n");
  }

  //& Exit

  private instruction$exit() {
    this.setPosition(this.tokens.length - 1);
  }

  //& Register Operations

  private instruction$setRegister() {
    const register = this.eatAndExpectToken<
      TokenSpec.RegisterReferenceToken<Registers.Name>
    >(TokenType.RegisterReference).value;

    const value = this.eatAndExpectValueFromCarrierToken();
    this.modifyRegister(register, value);
  }

  private instruction$setReturnRegister() {
    const value = this.eatAndExpectValueFromCarrierToken();
    this.modifyRegister(Registers.names.processReturn, value);
  }

  //& Mathematical Operations

  private instruction$mathAdd() {
    const a = this.eatAndExpectValueFromCarrierToken();
    const b = this.eatAndExpectValueFromCarrierToken();
    this.modifyRegister(Registers.names.accumulator, a + b);
  }

  private instruction$mathSubtract() {
    const a = this.eatAndExpectValueFromCarrierToken();
    const b = this.eatAndExpectValueFromCarrierToken();
    this.modifyRegister(Registers.names.accumulator, a - b);
  }

  private instruction$mathMultiply() {
    const a = this.eatAndExpectValueFromCarrierToken();
    const b = this.eatAndExpectValueFromCarrierToken();
    this.modifyRegister(Registers.names.accumulator, a * b);
  }

  private instruction$mathDivide() {
    const a = this.eatAndExpectValueFromCarrierToken();
    const b = this.eatAndExpectValueFromCarrierToken();
    this.modifyRegister(Registers.names.accumulator, a / b);
  }

  private instruction$mathFloor() {
    const a = this.eatAndExpectValueFromCarrierToken();
    this.modifyRegister(Registers.names.accumulator, Math.floor(a));
  }

  //& String Operations

  private instruction$stringConcat() {
    const a = this.eatAndExpectValueFromCarrierToken().toString();
    const b = this.eatAndExpectValueFromCarrierToken().toString();
    this.modifyRegister(Registers.names.complexDataRegister1, `${a}${b}`);
  }

  private instruction$stringConcatToCurrent() {
    const a = this.eatAndExpectValueFromCarrierToken().toString();
    this.modifyRegister(
      Registers.names.complexDataRegister1,
      `${this.registers.get(Registers.names.complexDataRegister1)}${a}`
    );
  }

  //& Conversion

  private instruction$convertToNumber() {
    const value = this.eatAndExpectValueFromCarrierToken();
    this.modifyRegister(Registers.names.accumulator, Number(value));
  }

  private instruction$convertBase() {
    const value = this.eatAndExpectValueFromCarrierToken();
    const fromToken = this.eatAndExpectToken<
      TokenSpec.NumericLiteralToken<number>
    >(TokenType.NumericLiteral);
    const toToken = this.eatAndExpectToken<
      TokenSpec.NumericLiteralToken<number>
    >(TokenType.NumericLiteral);

    if (!TryNumber.isPositiveSafeFiniteInteger(fromToken.value))
      throw new Error(
        NewError.Runtime.Execution.invalidConversionBase(fromToken)
      );

    if (!TryNumber.isPositiveSafeFiniteInteger(toToken.value))
      throw new Error(
        NewError.Runtime.Execution.invalidConversionBase(toToken)
      );

    const result = parseInt(value.toString(), fromToken.value).toString(
      toToken.value
    );

    this.modifyRegister(Registers.names.complexDataRegister1, result);
    this.modifyRegister(Registers.names.complexDataRegister2, toToken.value);
  }

  //& Array Operations

  private instruction$arrayPush() {
    const arrayToken = this.peekNextToken();
    const array = this.eatAndExpectValueFromCarrierToken();
    const value = this.eatAndExpectValueFromCarrierToken();

    if (!Array.isArray(array))
      throw new Error(
        NewError.Runtime.Execution.arrayOperationNotArray(arrayToken)
      );

    array.push(value);
    this.modifyRegister(Registers.names.complexDataRegister1, array);
  }

  private instruction$arrayPop() {
    const arrayToken = this.peekNextToken();
    const array = this.eatAndExpectValueFromCarrierToken();

    if (!Array.isArray(array))
      throw new Error(
        NewError.Runtime.Execution.arrayOperationNotArray(arrayToken)
      );

    const value = array.pop();
    this.modifyRegister(Registers.names.complexDataRegister1, array);
    this.modifyRegister(Registers.names.complexDataRegister2, value ?? null);
  }

  private instruction$arrayShift() {
    const arrayToken = this.peekNextToken();
    const array = this.eatAndExpectValueFromCarrierToken();

    if (!Array.isArray(array))
      throw new Error(
        NewError.Runtime.Execution.arrayOperationNotArray(arrayToken)
      );

    const value = array.shift();
    this.modifyRegister(Registers.names.complexDataRegister1, array);
    this.modifyRegister(Registers.names.complexDataRegister2, value ?? null);
  }

  private instruction$arrayUnshift() {
    const arrayToken = this.peekNextToken();
    const array = this.eatAndExpectValueFromCarrierToken();
    const value = this.eatAndExpectValueFromCarrierToken();

    if (!Array.isArray(array))
      throw new Error(
        NewError.Runtime.Execution.arrayOperationNotArray(arrayToken)
      );

    array.unshift(value);
    this.modifyRegister(Registers.names.complexDataRegister1, array);
  }

  private instruction$arrayElementAt() {
    const arrayToken = this.peekNextToken();
    const array = this.eatAndExpectValueFromCarrierToken();
    const index = this.eatAndExpectValueFromCarrierToken();

    if (!Array.isArray(array))
      throw new Error(
        NewError.Runtime.Execution.arrayOperationNotArray(arrayToken)
      );

    const value = array.at(Number(index));
    this.modifyRegister(Registers.names.complexDataRegister1, value ?? null);
  }

  private instruction$arrayLength() {
    const arrayToken = this.peekNextToken();
    const array = this.eatAndExpectValueFromCarrierToken();

    if (!Array.isArray(array))
      throw new Error(
        NewError.Runtime.Execution.arrayOperationNotArray(arrayToken)
      );

    const value = array.length;
    this.modifyRegister(Registers.names.accumulator, value);
  }

  //& Functions

  private instruction$declareFunction() {
    const identToken = this.eatAndExpectToken<
      TokenSpec.IdentifierToken<string>
    >(TokenType.Identifier);
    const ident = identToken.value;

    const arityToken = this.eatAndExpectToken<
      TokenSpec.NumericLiteralToken<number>
    >(TokenType.NumericLiteral);
    const arity = arityToken.value;

    if (!TryNumber.isPositiveSafeFiniteInteger(arityToken.value))
      throw new Error(
        NewError.Runtime.Execution.invalidFunctionArity(arityToken)
      );

    const tokensAtFunctionEnd = [
      NewToken.controlLabel(ControlLabels.names.functionDeclarationEnd, 0, 0),
      NewToken.identifier(ident, 0, 0),
    ].map(WanderingTokens.removeLocation);

    const functionBody = this.peekTokensUntilTokenArray(tokensAtFunctionEnd);

    if (!functionBody)
      throw new Error(
        NewError.Runtime.Execution.noFunctionDeclarationEndFound(identToken)
      );

    this.setPosition(
      this.getCurrentPosition() +
        functionBody.length +
        tokensAtFunctionEnd.length
    );

    functionBody.push(NewToken.endOfProcess(0, 0));

    this.modifyEnvironment(ident, { functionBody, arity });
  }

  private instruction$executeFunction() {
    const identToken = this.eatAndExpectOneOfToken<
      | TokenSpec.IdentifierToken<string>
      | TokenSpec.ModuleReferenceToken<string, string>
    >([TokenType.Identifier, TokenType.ModuleReference]);

    const { functionBody, arity }: FunctionInEnvironment = (() => {
      if (identToken.type === TokenType.Identifier) {
        const value = this.environment.get(identToken.value);
        if (!isValidFunction(value))
          throw new Error(
            NewError.Runtime.Execution.valueIsNotFunction(identToken)
          );
        return value;
      }

      const moduleName = identToken.module;
      const module = this.modules.get(moduleName);

      if (!module)
        throw new Error(NewError.Runtime.Execution.moduleNotFound(identToken));

      if (!module.exports.has(identToken.value))
        throw new Error(
          NewError.Runtime.Execution.undefinedValue(
            identToken.value,
            identToken
          )
        );

      const value = module.exports.get(identToken.value);
      if (!isValidFunction(value))
        throw new Error(
          NewError.Runtime.Execution.valueIsNotFunction(identToken)
        );

      return value;
    })();

    const args = [];

    while (args.length < arity) {
      args.push(this.eatAndExpectValueFromCarrierToken());
    }

    const scope = new Runtime({
      environment:
        identToken.type === TokenType.Identifier
          ? this.environment
          : this.modules.get(identToken.module)!.environment,
      registers: Registers.init([[Registers.names.processArguments, args]]),
    });

    const returnValue = scope.execute(functionBody);
    this.modifyRegister(Registers.names.processResult, returnValue);
  }

  //& Modules

  private instruction$export() {
    const identToken = this.eatAndExpectToken<
      TokenSpec.IdentifierToken<string>
    >(TokenType.Identifier);
    const ident = identToken.value;

    if (this.exports.has(ident))
      throw new Error(NewError.Runtime.Execution.duplicateExport(identToken));

    this.exports.set(ident, this.environment.get(ident));
  }

  private instruction$import() {
    const fileReferenceToken = this.eatAndExpectToken<
      TokenSpec.FileReferenceToken<string>
    >(TokenType.FileReference);
    const fileReference = fileReferenceToken.value;

    const modulePath = (() => {
      const arr = fileReference.split(".");
      const last = arr.pop();
      const penultimate = arr.pop();
      arr.push(`${penultimate}.${last}`);
      return path.join(process.cwd(), Modules.config.dir, ...arr);
    })();

    const moduleExists = fs.existsSync(modulePath);

    if (!moduleExists)
      throw new Error(
        NewError.Runtime.Execution.fileDoesNotExist(
          fileReferenceToken,
          modulePath
        )
      );

    const moduleSource = fs.readFileSync(modulePath, "utf8");

    const moduleScope = new Runtime();
    moduleScope.lexecute(moduleSource);

    const storeAs = fileReference.split(".").slice(0, -1).join(".");
    this.modules.set(storeAs, {
      exports: moduleScope.exports,
      environment: moduleScope.environment,
    });
  }

  //* Control Labels

  private controlLabel$label() {
    const token = this.eatAndExpectToken<TokenSpec.IdentifierToken<string>>(
      TokenType.Identifier
    );

    if (this.labels.has(token.value))
      throw new Error(NewError.Runtime.Execution.duplicateLabel(token));

    this.labels.add(token.value);
  }

  private controlLabel$functionDeclarationEnd() {
    // do nothing
  }

  //* Execution

  private executeInstruction() {
    const instructionToken = this.eatAndExpectToken<
      TokenSpec.InstructionToken<Instructions.Name>
    >(TokenType.Instruction);

    const instructionEntry = Object.entries(Instructions.names).find(
      ([_key, value]) => instructionToken.value === value
    )!;
    const instructionName =
      instructionEntry[0] as keyof typeof Instructions.names;

    this[`instruction$${instructionName}`]();
  }

  private handleControlLabel() {
    const controlLabelToken = this.eatAndExpectToken<
      TokenSpec.ControlLabelToken<ControlLabels.Name>
    >(TokenType.ControlLabel);

    const controlLabelEntry = Object.entries(ControlLabels.names).find(
      ([_key, value]) => controlLabelToken.value === value
    )!;
    const controlLabelName =
      controlLabelEntry[0] as keyof typeof ControlLabels.names;

    this[`controlLabel$${controlLabelName}`]();
  }

  private executeStatement() {
    const statement = this.peekNextToken();

    if (statement.type === TokenType.Instruction) this.executeInstruction();
    else if (statement.type === TokenType.ControlLabel)
      this.handleControlLabel();
    else
      throw new Error(
        NewError.Runtime.Execution.unexpectedStatementType(statement)
      );
  }

  public execute(source: TokenSpec.AnyToken[]) {
    this.tokens = source;
    while (this.peekNextToken().type !== TokenType.EndOfProcess)
      this.executeStatement();
    return this.registers.get(Registers.names.processReturn);
  }

  public lexecute(source: string) {
    this.execute(lex(source));
  }
}
