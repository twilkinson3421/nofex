export namespace Instructions {
  export const names = {
    setVariable: "sta",
    loadVariable: "lda",

    compare: "cmp",
    branchAlways: "bra",
    branchIfGreaterThan: "brg",
    branchIfLessThan: "brl",
    branchIfEqualTo: "bre",
    branchIfNotEqualTo: "bne",
    branchIfZero: "brz",
    branchIfPositive: "brp",
    branchIfNegative: "brn",

    writeLine: "log",
    standardOutput: "out",
    standardError: "err",
    standardInput: "inp",
    newLine: "rlf",

    exit: "hlt",

    setRegister: "reg",
    setReturnRegister: "ret",

    mathAdd: "add",
    mathSubtract: "sub",
    mathMultiply: "mul",
    mathDivide: "div",
    mathFloor: "flr",

    stringConcat: "con",
    stringConcatToCurrent: "_",

    convertToNumber: "num",

    arrayPush: "psh",
    arrayPop: "pop",
    arrayShift: "sft",
    arrayUnshift: "uns",
    arrayElementAt: "elm",
    arrayLength: "len",

    declareFunction: "fun",
    executeFunction: "exe",

    export: "exp",
    import: "use",
  } as const;

  export type Name = (typeof names)[keyof typeof names];

  export const all = new Set<Name>(Object.values(names));
}
