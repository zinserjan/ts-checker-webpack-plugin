
declare module "normalize-path" {
  function normalizePath(path: string, stripTrailing?: boolean): string;
  export = normalizePath;
}
