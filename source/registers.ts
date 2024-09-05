export namespace Registers {
  export const names = {
    positionCounter: "POS",
    processReturn: "RET",
    accumulator: "ACC",
    previousAccumulator: "PAC",
    positionBeforeBranch: "PBB",

    complexDataRegister1: "CDR1",
    complexDataRegister2: "CDR2",
    complexDataRegister3: "CDR3",
    complexDataRegister4: "CDR4",
    complexDataRegister5: "CDR5",
    complexDataRegister6: "CDR6",
    complexDataRegister7: "CDR7",
    complexDataRegister8: "CDR8",
    complexOverwrittenRegister: "XCO",

    processArguments: "ARG",
    processResult: "RES",
  } as const;

  export type Name = (typeof names)[keyof typeof names];

  export const init = (overrides?: Array<[Name, any]>) =>
    new Map<Name, any>([
      [names.positionCounter, 0],
      [names.processReturn, null],
      [names.accumulator, 0],
      [names.previousAccumulator, 0],
      [names.positionBeforeBranch, 0],

      [names.complexDataRegister1, null],
      [names.complexDataRegister2, null],
      [names.complexDataRegister3, null],
      [names.complexDataRegister4, null],
      [names.complexDataRegister5, null],
      [names.complexDataRegister6, null],
      [names.complexDataRegister7, null],
      [names.complexDataRegister8, null],
      [names.complexOverwrittenRegister, null],

      [names.processArguments, []],
      [names.processResult, null],

      ...(overrides ?? []),
    ]);
}
