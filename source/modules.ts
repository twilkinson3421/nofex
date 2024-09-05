export namespace Modules {
  export const config = {
    dir: "nofex_modules",
  } as const;

  export type ImportedModule = {
    exports: Map<string, any>;
    environment: Map<string, any>;
  };

  export const init = () => new Map<string, ImportedModule>();

  export namespace Exports {
    export const init = () => new Map<string, any>();
  }
}
