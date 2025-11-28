declare module 'lua-format' {
  interface Options {
    RenameVariables?: boolean;
    RenameGlobals?: boolean;
    SolveMath?: boolean;
    Indentation?: string;
  }

  export function Beautify(code: string, options?: Options): string;
  export function Minify(code: string, options?: Options): string;
}
