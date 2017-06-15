import { Compiler } from "webpack";

export interface TsCheckerWebpackPluginOptions {}

export default class TsCheckerWebpackPlugin {
  watchMode: boolean;

  constructor(options: TsCheckerWebpackPluginOptions = {}) {
    this.watchMode = false; // will be overridden in watch mode
  }

  apply(compiler: Compiler) {
    compiler.plugin("watch-run", (watching, callback) => {
      this.watchMode = true;
      callback();
    });

    compiler.plugin("after-compile", (compilation, callback) => {
      // start type checking
    });

    compiler.plugin("done", () => {
      // we don't need this hook
    });
  }
}
