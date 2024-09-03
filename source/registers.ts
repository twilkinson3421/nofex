export const registerNames = {
  position_counter: "IPX",
  return_register: "RET",

  accumulator: "IAX",
  previous_accumulator: "IOA",
  position_before_branch: "IBX",

  complex_data_register_1: "XC1",
  complex_data_register_2: "XC2",
  complex_data_register_3: "XC3",
  complex_data_register_4: "XC4",
  complex_data_register_5: "XC5",
  complex_data_register_6: "XC6",
  complex_data_register_7: "XC7",
  complex_data_register_8: "XC8",
  complex_overwritten_register: "XOC",

  generic_stack: "LSX",
  generic_stack_length: "ISL",

  function_arguments: "LFA",
  function_result: "FUN",
} as const;

export type RegisterName = (typeof registerNames)[keyof typeof registerNames];

export const initRegisters = (overrides?: Array<[RegisterName, any]>) =>
  new Map<RegisterName, any>([
    [registerNames.position_counter, 0],
    [registerNames.return_register, null],
    [registerNames.accumulator, 0],
    [registerNames.previous_accumulator, 0],
    [registerNames.position_before_branch, 0],

    [registerNames.complex_data_register_1, null],
    [registerNames.complex_data_register_2, null],
    [registerNames.complex_data_register_3, null],
    [registerNames.complex_data_register_4, null],
    [registerNames.complex_data_register_5, null],
    [registerNames.complex_data_register_6, null],
    [registerNames.complex_data_register_7, null],
    [registerNames.complex_data_register_8, null],
    [registerNames.complex_overwritten_register, null],

    [registerNames.generic_stack, []],
    [registerNames.generic_stack_length, 0],

    [registerNames.function_arguments, []],
    [registerNames.function_result, null],

    ...(overrides ?? []),
  ]);
