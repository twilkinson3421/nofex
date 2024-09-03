import * as fs from "fs";
import * as path from "path";
import * as readlineSync from "readline-sync";

import { initEnvironment } from "./environment.js";
import { lex } from "./lexer.js";
import { MODULE_DIR } from "./modules.js";
import { OperationName, operationNames, operations } from "./operations.js";
import { RegisterName, initRegisters, registerNames } from "./registers.js";
import {
  FileRefToken,
  FunctionArgumentRefToken,
  IdentToken,
  InitToken,
  LexedToken,
  ModuleRefToken,
  NumericLiteralToken,
  OperationToken,
  RegisterRefToken,
  StringLiteralToken,
  TokenType,
  getDebugFromType,
} from "./tokens.js";

export type RuntimeOptions = {
  environment?: Map<string, any>;
  registers?: Map<RegisterName, any>;
};

export class Runtime {
  private tokens: LexedToken[] = [];
  private environment = initEnvironment();
  private registers = initRegisters();
  private modules: Map<
    string,
    { exports: Map<string, any>; environment: Map<string, any> }
  > = new Map();
  private exports: Map<string, any> = new Map();

  public getEnvironment() {
    return this.environment;
  }

  public getExports() {
    return this.exports;
  }

  constructor(options?: RuntimeOptions) {
    if (options?.environment) this.environment = options.environment;
    if (options?.registers) this.registers = options.registers;
  }

  // Token Utils

  private peekNextToken(): LexedToken {
    return this.tokens[this.registers.get(registerNames.position_counter)];
  }

  private peekNextNTokens(n: number): LexedToken[] {
    return this.tokens.slice(
      this.registers.get(registerNames.position_counter),
      this.registers.get(registerNames.position_counter) + n
    );
  }

  private peekTokensBetween(start: number, end: number): LexedToken[] {
    return this.tokens.slice(start, end);
  }

  private eatToken<T extends LexedToken>(): T {
    const token = this.peekNextToken();
    this.modifyRegister(
      registerNames.position_counter,
      this.registers.get(registerNames.position_counter) + 1
    );
    return token as T;
  }

  private eatAndExpectToken<T extends LexedToken>(
    expectedTokenType: TokenType
  ) {
    const token = this.eatToken<T>();
    if (token.type !== expectedTokenType) {
      console.error(
        `Expected token of type ${
          getDebugFromType(expectedTokenType) ?? expectedTokenType
        } at position ${this.registers.get(
          registerNames.position_counter
        )}, but got ${token.debug} instead`
      );
      process.exit(1);
    }
    return token;
  }

  private eatAndExpectOneOfToken<T extends LexedToken>(
    expectedTokenTypes: TokenType[]
  ) {
    const token = this.eatToken<T>();
    if (!expectedTokenTypes.includes(token.type)) {
      console.error(
        `Expected token of type: one of ${expectedTokenTypes}, but got ${token.type} instead`
      );
      process.exit(1);
    }
    return token;
  }

  private eatAndExpectValueToken() {
    return this.eatAndExpectOneOfToken<
      | StringLiteralToken<string>
      | NumericLiteralToken<number>
      | IdentToken<string>
      | RegisterRefToken<RegisterName>
      | FunctionArgumentRefToken<number>
      | ModuleRefToken<string, string>
    >([
      TokenType.StringLiteral,
      TokenType.NumericLiteral,
      TokenType.Identifier,
      TokenType.RegisterRef,
      TokenType.FunctionArgumentRef,
      TokenType.ModuleRef,
    ]);
  }

  private eatValueFromNextToken(): string | number {
    const token = this.eatAndExpectValueToken();
    const tokenType = token.type;
    let value;

    if (tokenType === TokenType.Identifier)
      value = this.environment.get(token.value);
    else if (tokenType === TokenType.RegisterRef)
      value = this.registers.get(token.value);
    else if (tokenType === TokenType.FunctionArgumentRef)
      value = this.registers
        .get(registerNames.function_arguments)
        .at(token.value);
    else if (tokenType === TokenType.ModuleRef)
      value = this.modules.get(token.module)?.exports.get(token.value);
    else value = token.value;

    if (typeof value === "undefined") {
      console.error(
        `Value referenced by ${token.debug}: "${
          token.value
        }" at position ${this.registers.get(
          registerNames.position_counter
        )} is undefined`
      );
      process.exit(1);
    }

    return value;
  }

  private eatNumericValueFromNextToken() {
    const value = this.eatValueFromNextToken();
    return Number(value);
  }

  private eatStringValueFromNextToken() {
    const value = this.eatValueFromNextToken();
    if (typeof value !== "string") {
      console.error(`Expected string value, but got "${value}" instead`);
      process.exit(1);
    }

    return value;
  }

  private eatIdentifierNameFromNextToken() {
    const value = this.eatAndExpectToken<IdentToken<string>>(
      TokenType.Identifier
    ).value;
    return value;
  }

  private numberIsPositiveSafeInteger(value: number) {
    return (
      value >= 0 &&
      Number.isInteger(value) &&
      Number.isFinite(value) &&
      Number.isSafeInteger(value)
    );
  }

  // Handle Comment

  private handleComment() {
    this.eatAndExpectToken(TokenType.Comment);
  }

  // Program Flow

  private gotoLabel(label: string) {
    let index = 0;

    const targetTokenArray = [
      InitToken.operation(operationNames.label),
      InitToken.ident(label),
    ];

    while (true) {
      const tokens = this.peekTokensBetween(
        index,
        index + targetTokenArray.length
      );
      if (tokens.includes(InitToken.eof())) break;

      if (JSON.stringify(tokens) === JSON.stringify(targetTokenArray)) {
        this.modifyRegister(registerNames.position_counter, index);
        return;
      }

      index++;
    }

    console.error(
      `No matching label was found in source for branch to label "${label}"`
    );
    process.exit(1);
  }

  private modifyRegister(register: RegisterName, value: any) {
    switch (register) {
      case registerNames.position_counter:
        this.registers.set(
          registerNames.position_before_branch,
          this.registers.get(registerNames.position_counter)
        );
        this.registers.set(register, value);
        break;
      case registerNames.accumulator:
        this.registers.set(
          registerNames.previous_accumulator,
          this.registers.get(registerNames.accumulator)
        );
        this.registers.set(registerNames.accumulator, value);
        break;
      case registerNames.complex_data_register_1:
      case registerNames.complex_data_register_2:
      case registerNames.complex_data_register_3:
      case registerNames.complex_data_register_4:
        this.registers.set(
          registerNames.complex_overwritten_register,
          this.registers.get(register)
        );
        this.registers.set(register, value);
        break;
      case registerNames.generic_stack:
        this.registers.set(register, value);
        this.modifyRegister(registerNames.generic_stack_length, value.length);
        break;
      default:
        this.registers.set(register, value);
        break;
    }
  }

  private modifyEnvironment(ident: string, value: any) {
    this.environment.set(ident, value);
  }

  private expectFromEnvironment(ident: string) {
    const value = this.environment.get(ident);
    if (typeof value === "undefined") {
      console.error(`Value "${ident}" is accessed before it is defined`);
      process.exit(1);
    }
    return value;
  }

  private operation_exit() {
    const code = this.eatAndExpectToken<NumericLiteralToken<number>>(
      TokenType.NumericLiteral
    ).value;

    process.exit(code);
  }

  private operation_set_register() {
    const register = this.eatAndExpectToken<RegisterRefToken<RegisterName>>(
      TokenType.RegisterRef
    ).value;

    const value = this.eatValueFromNextToken();
    this.modifyRegister(register, value);
  }

  private operation_label() {
    this.eatAndExpectToken(TokenType.Identifier);
  }

  private operation_set_return_register() {
    const value = this.eatValueFromNextToken();
    this.modifyRegister(registerNames.return_register, value);
  }

  // Variable Operations

  private operation_set_variable() {
    const ident = this.eatIdentifierNameFromNextToken();
    const value = this.eatValueFromNextToken();
    this.modifyEnvironment(ident, value);
  }

  private operation_load_variable() {
    const ident = this.eatIdentifierNameFromNextToken();
    const value = this.expectFromEnvironment(ident);
    this.modifyRegister(registerNames.complex_data_register_1, value);
  }

  // Logical Operations

  private operation_compare() {
    const comparisonWith = this.eatValueFromNextToken();
    const comparisonSubject = this.eatValueFromNextToken();

    if (comparisonSubject === comparisonWith)
      this.modifyRegister(registerNames.accumulator, 0);
    else if (comparisonSubject > comparisonWith)
      this.modifyRegister(registerNames.accumulator, 1);
    else this.modifyRegister(registerNames.accumulator, -1);
  }

  private operation_branch_always() {
    const label = this.eatIdentifierNameFromNextToken();
    this.gotoLabel(label);
  }

  private operation_branch_if_greater_than() {
    if (this.registers.get(registerNames.accumulator) === 1)
      this.operation_branch_always();
    else this.eatAndExpectToken(TokenType.Identifier);
  }

  private operation_branch_if_less_than() {
    if (this.registers.get(registerNames.accumulator) === -1)
      this.operation_branch_always();
    else this.eatAndExpectToken(TokenType.Identifier);
  }

  private operation_branch_if_equal_to() {
    if (this.registers.get(registerNames.accumulator) === 0)
      this.operation_branch_always();
    else this.eatAndExpectToken(TokenType.Identifier);
  }

  private operation_branch_if_not_equal_to() {
    if (this.registers.get(registerNames.accumulator) !== 0)
      this.operation_branch_always();
    else this.eatAndExpectToken(TokenType.Identifier);
  }

  private operation_branch_if_zero() {
    if (this.registers.get(registerNames.accumulator) === 0)
      this.operation_branch_always();
    else this.eatAndExpectToken(TokenType.Identifier);
  }

  private operation_branch_if_positive() {
    if (this.registers.get(registerNames.accumulator) > 0)
      this.operation_branch_always();
    else this.eatAndExpectToken(TokenType.Identifier);
  }

  private operation_branch_if_negative() {
    if (this.registers.get(registerNames.accumulator) < 0)
      this.operation_branch_always();
    else this.eatAndExpectToken(TokenType.Identifier);
  }

  // Input/Output Operations

  private operation_write_line() {
    const message = this.eatValueFromNextToken();
    process.stdout.write(`${message}\n`);
  }

  private operation_standard_output() {
    const message = this.eatValueFromNextToken();
    process.stdout.write(`${message}`);
  }

  private operation_standard_error() {
    const message = this.eatValueFromNextToken();
    process.stderr.write(`${message}`);
  }

  private operation_standard_input() {
    const prompt = this.eatValueFromNextToken();

    const input = readlineSync.question(prompt);
    this.modifyRegister(registerNames.complex_data_register_1, input);
  }

  // Mathematical Operations

  private operation_math_add() {
    const a = this.eatNumericValueFromNextToken();
    const b = this.eatNumericValueFromNextToken();

    this.modifyRegister(registerNames.accumulator, a + b);
  }

  private operation_math_subtract() {
    const a = this.eatNumericValueFromNextToken();
    const b = this.eatNumericValueFromNextToken();
    this.modifyRegister(registerNames.accumulator, a - b);
  }

  private operation_math_multiply() {
    const a = this.eatNumericValueFromNextToken();
    const b = this.eatNumericValueFromNextToken();
    this.modifyRegister(registerNames.accumulator, a * b);
  }

  private operation_math_divide() {
    const a = this.eatNumericValueFromNextToken();
    const b = this.eatNumericValueFromNextToken();
    this.modifyRegister(registerNames.accumulator, a / b);
  }

  private operation_math_floor() {
    const a = this.eatNumericValueFromNextToken();
    this.modifyRegister(registerNames.accumulator, Math.floor(a));
  }

  // String Operations

  private operation_string_concat() {
    const a = this.eatValueFromNextToken().toString();
    const b = this.eatValueFromNextToken().toString();
    this.modifyRegister(registerNames.complex_data_register_1, `${a}${b}`);
  }

  private operation_string_concat_to_current() {
    const a = this.eatValueFromNextToken().toString();
    this.modifyRegister(
      registerNames.complex_data_register_1,
      `${this.registers.get(registerNames.complex_data_register_1)}${a}`
    );
  }

  // Stack Operation Helpers

  private pushToStack(value: any) {
    this.registers.get(registerNames.generic_stack).push(value);
    this.modifyRegister(
      registerNames.generic_stack,
      this.registers.get(registerNames.generic_stack)
    );
  }

  private popFromStack() {
    const value = this.registers.get(registerNames.generic_stack).pop();
    this.modifyRegister(
      registerNames.generic_stack,
      this.registers.get(registerNames.generic_stack)
    );
    return value;
  }

  private shiftFromStack() {
    const value = this.registers.get(registerNames.generic_stack).shift();
    this.modifyRegister(
      registerNames.generic_stack,
      this.registers.get(registerNames.generic_stack)
    );
    return value;
  }

  private unshiftToStack(value: any) {
    this.registers.get(registerNames.generic_stack).unshift(value);
    this.modifyRegister(
      registerNames.generic_stack,
      this.registers.get(registerNames.generic_stack)
    );
  }

  // Stack Operations

  private operation_stack_push() {
    const value = this.eatValueFromNextToken();
    this.pushToStack(value);
  }

  private operation_stack_pop() {
    this.modifyRegister(
      registerNames.complex_data_register_1,
      this.popFromStack()
    );
  }

  private operation_stack_shift() {
    this.modifyRegister(
      registerNames.complex_data_register_1,
      this.shiftFromStack()
    );
  }

  private operation_stack_unshift() {
    const value = this.eatValueFromNextToken();
    this.unshiftToStack(value);
  }

  private operation_stack_element_at() {
    const index = this.eatNumericValueFromNextToken();
    this.modifyRegister(
      registerNames.complex_data_register_1,
      this.registers.get(registerNames.generic_stack).at(index)
    );
  }

  // Functions

  private operation_function_start() {
    const ident = this.eatIdentifierNameFromNextToken();
    const arity = this.eatNumericValueFromNextToken();

    if (!this.numberIsPositiveSafeInteger(arity)) {
      console.error(
        `Invalid arity: "${arity}", for function: "${ident}", at position ${this.registers.get(
          registerNames.position_counter
        )}`
      );
      process.exit(1);
    }

    const tokensAtFunctionEnd = [
      InitToken.operation(operationNames.function_end),
      InitToken.ident(ident),
    ];

    const functionBody: LexedToken[] = [];
    let index = this.registers.get(registerNames.position_counter);

    while (true) {
      const tokens = this.peekTokensBetween(
        index,
        tokensAtFunctionEnd.length + index
      );
      if (tokens.includes(InitToken.eof())) break;

      if (JSON.stringify(tokens) === JSON.stringify(tokensAtFunctionEnd)) {
        this.modifyRegister(
          registerNames.position_counter,
          index + tokensAtFunctionEnd.length
        ); // skip over the function end
        break;
      }

      functionBody.push(this.eatToken());
      index++;
    }

    functionBody.push(InitToken.eof());

    if (this.environment.has(ident)) {
      console.error(
        `"${ident}" is already defined and cannot be overwritten by a function`
      );
      process.exit(1);
    }

    this.modifyEnvironment(ident, { functionBody, arity });
  }

  private operation_function_end() {
    // will never be called
  }

  private operation_function_call() {
    const identToken = this.eatAndExpectOneOfToken<
      IdentToken<string> | ModuleRefToken<string, string>
    >([TokenType.Identifier, TokenType.ModuleRef]);

    const {
      functionBody,
      arity,
    }: { functionBody: LexedToken[]; arity: number } = (() => {
      if (identToken.type === TokenType.Identifier)
        return this.expectFromEnvironment(identToken.value);

      const moduleName = identToken.module;
      const module = this.modules.get(moduleName);
      if (!module) {
        console.error(`Module "${moduleName}" has not been imported`);
        process.exit(1);
      }

      if (!module.exports.has(identToken.value)) {
        console.error(
          `Export "${identToken.value}" was not found in module "${moduleName}"`
        );
        process.exit(1);
      }

      return module.exports.get(identToken.value);
    })();

    const args = [];

    while (args.length < arity) {
      args.push(this.eatValueFromNextToken());
    }

    const scope = new Runtime({
      environment:
        identToken.type === TokenType.Identifier
          ? this.environment
          : this.modules.get(identToken.module)!.environment,
      registers: initRegisters([[registerNames.function_arguments, args]]),
    });
    const returnValue = scope.execute(functionBody);
    this.modifyRegister(registerNames.function_result, returnValue);
  }

  // Modules

  private operation_export() {
    const ident = this.eatIdentifierNameFromNextToken();
    if (this.exports.has(ident)) {
      console.error(`Export "${ident}" is already defined`);
      process.exit(1);
    }
    this.exports.set(ident, this.environment.get(ident));
  }

  private operation_import() {
    const moduleName = this.eatAndExpectToken<FileRefToken<string>>(
      TokenType.FileRef
    ).value;

    const splitPath = moduleName.split(".");
    const lastTwo = splitPath.splice(-2, 2);
    splitPath.push(lastTwo.join("."));

    const modulePath = path.join(process.cwd(), MODULE_DIR, ...splitPath);
    const moduleExists = fs.existsSync(modulePath);

    if (!moduleExists) {
      console.error(`Module "${moduleName}" was not found at "${modulePath}"`);
      process.exit(1);
    }

    const moduleSource = fs.readFileSync(modulePath, "utf8");
    const moduleScope = new Runtime();
    moduleScope.execute(moduleSource);
    const storeAs = moduleName.split(".").slice(0, -1).join(".");
    this.modules.set(storeAs, {
      exports: moduleScope.getExports(),
      environment: moduleScope.getEnvironment(),
    });
  }

  // Program Execution

  private executeOperation() {
    const operation = this.eatAndExpectToken<OperationToken<OperationName>>(
      TokenType.Operation
    ).value;

    if (operations.has(operation)) {
      const opKey = Object.entries(operationNames).find(
        ([mn, on]) => operation === on
      )?.[0] as keyof typeof operationNames;
      this[`operation_${opKey}`]();
    } else {
      console.error(`Operation ${operation} is undefined`);
      process.exit(1);
    }
  }

  private executeInstruction() {
    const instructionToken = this.peekNextToken();
    const instructionType = instructionToken.type;

    if (instructionType === TokenType.Operation) this.executeOperation();
    else if (instructionType === TokenType.Comment) this.handleComment();
    else {
      console.error(
        `Unexpected instruction type encountered: ${instructionToken.debug}: "${
          (instructionToken as any).value ?? ""
        }" at position ${this.registers.get(registerNames.position_counter)}`
      );
      process.exit(1);
    }
  }

  public execute(source: string | LexedToken[]) {
    this.tokens = typeof source === "string" ? lex(source) : source;

    while (this.peekNextToken().type !== TokenType.EndOfFile)
      this.executeInstruction();

    return this.registers.get(registerNames.return_register);
  }
}

// TODO: Proper Error Messages
// TODO: Throw Errors instead of exiting
