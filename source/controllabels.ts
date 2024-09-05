export namespace ControlLabels {
  export const names = {
    label: "lbl",
    functionDeclarationEnd: "efn",
  } as const;

  export type Name = (typeof names)[keyof typeof names];

  export const all = new Set<Name>(Object.values(names));
}
