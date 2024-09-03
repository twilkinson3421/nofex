export type OperationDeclaration = {};

export const operationNames = {
  set_variable: "sta",
  load_variable: "lda",

  compare: "cmp",

  branch_always: "bra",
  branch_if_greater_than: "brg",
  branch_if_less_than: "brl",
  branch_if_equal_to: "bre",
  branch_if_not_equal_to: "bne",
  branch_if_zero: "brz",
  branch_if_positive: "brp",
  branch_if_negative: "brn",
  label: "lbl",

  write_line: "out",
  standard_output: "put",
  standard_error: "err",
  standard_input: "inp",

  exit: "hlt",

  set_register: "reg",
  set_return_register: "ret",

  math_add: "add",
  math_subtract: "sub",
  math_multiply: "mul",
  math_divide: "div",
  math_floor: "flr",

  string_concat: "con",
  string_concat_to_current: "_",

  stack_push: "psh",
  stack_pop: "pop",
  stack_shift: "sft",
  stack_unshift: "uns",
  stack_element_at: "elm",

  function_start: "fun",
  function_end: "efn",
  function_call: "exe",

  export: "exp",
  import: "use",
} as const;

export type OperationName =
  (typeof operationNames)[keyof typeof operationNames];

export const operations = new Map<OperationName, OperationDeclaration>(
  Object.entries(operationNames).map(([_key, value]) => [value, {}])
);
