import * as readlineSync from "readline-sync";

import { initEnvironment } from "./environment.js";
import { lex } from "./lexer.js";
import { OperationName, operationNames, operations } from "./operations.js";
import { RegisterName, initRegisters, registerNames } from "./registers.js";
import {
  FunctionArgumentRefToken,
  IdentToken,
  InitToken,
  LexedToken,
  NumericLiteralToken,
  OperationToken,
  RegisterRefToken,
  StringLiteralToken,
  TokenType,
  getDebugFromType
} from "./tokens.js";

export type RuntimeOptions = {
  environment?: Map<string, any>;
};

export class Runtime {
  private tokens: LexedToken[] = [];
  private environment = initEnvironment();
  private registers = initRegisters();

  constructor(options?: RuntimeOptions) {
    if (options?.environment) this.environment = options.environment;
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

  private eatAndExpectValueToken() {
    return this.eatAndExpectOneOfToken<
      | StringLiteralToken<string>
      | NumericLiteralToken<number>
      | IdentToken<string>
      | RegisterRefToken<RegisterName>
      | FunctionArgumentRefToken<number>
    >([
      TokenType.StringLiteral,
      TokenType.NumericLiteral,
      TokenType.Identifier,
      TokenType.RegisterRef,
      TokenType.FunctionArgumentRef,
    ]);
  }

  private eatAndExpectOneOfToken<T extends LexedToken>(
    expectedTokenTypes: TokenType[]
  ) {
    const token = this.eatToken<T>();
    if (!expectedTokenTypes.includes(token.type)) {
      console.error(
        `Expect token of type: one of ${expectedTokenTypes}, but got ${token.type} instead`
      );
      process.exit(1);
    }
    return token;
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
        .get(registerNames.function_arguments_stack)
        .at(-1)
        .at(token.value);
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

  // Variable Operations

  private operation_set_variable() {
    const ident = this.eatAndExpectToken<IdentToken<string>>(
      TokenType.Identifier
    ).value;

    const value = this.eatValueFromNextToken();
    this.environment.set(ident, value);
  }

  private operation_load_variable() {
    const ident = this.eatAndExpectToken<IdentToken<string>>(
      TokenType.Identifier
    ).value;

    const value = this.environment.get(ident);
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
    const label = this.eatAndExpectToken<IdentToken<string>>(
      TokenType.Identifier
    ).value;
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

  private operation_math_modulo() {
    const a = this.eatNumericValueFromNextToken();
    const b = this.eatNumericValueFromNextToken();
    this.modifyRegister(registerNames.accumulator, a % b);
  }

  private operation_math_absolute() {
    const a = this.eatNumericValueFromNextToken();
    this.modifyRegister(registerNames.accumulator, Math.abs(a));
  }

  private operation_math_exponent() {
    const a = this.eatNumericValueFromNextToken();
    const b = this.eatNumericValueFromNextToken();
    this.modifyRegister(registerNames.accumulator, Math.pow(a, b));
  }

  // String Operations

  private operation_string_concat() {
    const a = this.eatStringValueFromNextToken();
    const b = this.eatStringValueFromNextToken();
    this.modifyRegister(registerNames.complex_data_register_1, `${a}${b}`);
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
    // Ignores the function body; this is the declaration only - not the function call!

    const ident = this.eatAndExpectToken<IdentToken<string>>(
      TokenType.Identifier
    ).value;

    const tokensAtFunctionEnd = [
      InitToken.operation(operationNames.function_end),
      InitToken.ident(ident),
    ];

    let index = this.registers.get(registerNames.position_counter);

    while (true) {
      const tokens = this.peekTokensBetween(
        index,
        index + tokensAtFunctionEnd.length
      );
      if (tokens.includes(InitToken.eof())) break;

      if (JSON.stringify(tokens) === JSON.stringify(tokensAtFunctionEnd)) {
        this.modifyRegister(
          registerNames.position_counter,
          index + tokensAtFunctionEnd.length
        );
        // skip over the function end ->
        // the function end operation is used to determine the end of the function
        // when the function is called
        return;
      }

      index++;
    }

    console.error(
      `No matching function end was found in source for function "${ident}"`
    );
    process.exit(1);
  }

  private operation_function_end() {
    this.registers.get(registerNames.function_arguments_stack).pop();
    const returnPosition = this.registers
      .get(registerNames.function_return_position_stack)
      .pop();
    this.modifyRegister(registerNames.position_counter, returnPosition);
  }

  private getFunctionArityAndPosition(ident: string) {
    const tokensAtFunctionStart = [
      InitToken.operation(operationNames.function_start),
      InitToken.ident(ident),
    ];

    let index = 0;

    while (true) {
      const tokens = this.peekTokensBetween(
        index,
        index + tokensAtFunctionStart.length
      );
      if (tokens.includes(InitToken.eof())) break;

      const arityTokenPosition = index + tokensAtFunctionStart.length;
      const functionBodyStartPosition = arityTokenPosition + 1;

      if (JSON.stringify(tokens) === JSON.stringify(tokensAtFunctionStart)) {
        const declaration = this.peekTokensBetween(
          index,
          arityTokenPosition + 1
        );
        const arityToken = declaration.at(-1) as NumericLiteralToken<number>;
        return [arityToken.value, functionBodyStartPosition] as const;
      }

      index++;
    }

    console.error(`No definition for function "${ident}" was found in source`);
    process.exit(1);
  }

  private operation_function_call() {
    const ident = this.eatAndExpectToken<IdentToken<string>>(
      TokenType.Identifier
    ).value;

    const [arity, startPosition] = this.getFunctionArityAndPosition(ident);

    if (
      arity < 0 ||
      Number.isNaN(arity) ||
      !Number.isInteger(arity) ||
      !Number.isFinite(arity) ||
      !Number.isSafeInteger(arity)
    ) {
      console.error(
        `Invalid arity: "${arity}", for function: "${ident}", at position ${this.registers.get(
          registerNames.position_counter
        )}`
      );
      process.exit(1);
    }

    const args = [];

    while (args.length < arity) {
      args.push(this.eatValueFromNextToken());
    }

    this.registers.get(registerNames.function_arguments_stack).push(args);
    this.registers
      .get(registerNames.function_return_position_stack)
      .push(this.registers.get(registerNames.position_counter)); // position to return to after the function has finished
    this.modifyRegister(registerNames.position_counter, startPosition);
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

  public execute(source: string) {
    this.tokens = lex(source);

    while (this.peekNextToken().type !== TokenType.EndOfFile)
      this.executeInstruction();

    return this.registers.get(registerNames.return_register);
  }
}

// TODO: Add "private"? environment for things such as:
// TODO:  - Preventing a function from being defined more than once
// TODO:  - Preventing a label from being defined more than once

// TODO: Proper Error Messages
// TODO: Throw Errors instead of exiting

// TODO: Import (via "use") from other files
// TODO: Will simply lex the imported file, and prepend the tokens to the current file (actually just place them at the current position)
