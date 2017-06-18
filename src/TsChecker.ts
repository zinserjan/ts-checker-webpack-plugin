import PCancelable = require("p-cancelable");
import { DiagnosticError } from "./util/Error";
import IncrementalChecker from "./util/IncrementalChecker";

export type TsCheckerResult = {
  diagnostics: Array<DiagnosticError>;
  lints: Array<DiagnosticError>;
  time: number;
};

export type TsCheckerOptions = {
  tsconfigPath: string;
  tslintPath?: string;
  workers: number;
  memoryLimit: number;
};

export default class TsChecker {
  private incrementalChecker: IncrementalChecker;

  constructor(tsconfigPath: string) {
    this.incrementalChecker = new IncrementalChecker(tsconfigPath);
  }

  /**
   * Checks type checking and linting
   */
  check(): PCancelable<TsCheckerResult> {
    const start = Date.now();

    return new PCancelable((onCancel, resolve: (result: TsCheckerResult) => void, reject: (error: Error) => void) => {
      // onCancel(() => {
      //   this.abort();
      // });

      const { diagnostics, lints } = this.incrementalChecker.run();

      resolve({
        diagnostics,
        lints,
        time: Date.now() - start,
      });
    });
  }

  /**
   * Updates our file list with the latest one that were built by webpack
   */
  updateBuiltFiles(changes: Array<string>) {
    this.incrementalChecker.updateBuiltFiles(changes);
  }

  /**
   * Invalidate all files that were changed in general (also non-webpack modules)
   */
  invalidateFiles(changes: Array<string>, removals: Array<string>) {
    this.incrementalChecker.invalidateFiles(changes, removals);
  }

  getTypeCheckRelatedFiles() {
    return this.incrementalChecker.getTypeCheckRelatedFiles();
  }

  /**
   * Kills the checker
   */
  public kill() {}

  // /**
  //  * Aborts the actual type checking or linting
  //  */
  // private abort() {
  //
  // }
}
