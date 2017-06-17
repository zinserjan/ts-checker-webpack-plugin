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

  invalidate(changes: Array<string>, removals: Array<string>) {
    this.incrementalChecker.invalidateFiles(changes, removals);
  }

  setWatchMode(enabled: boolean) {
    this.incrementalChecker.setWatchMode(enabled);
  }

  setWatchOptions(watchOptions: {}) {
    this.incrementalChecker.setWatchOptions(watchOptions);
  }

  getOtherFiles() {
    return this.incrementalChecker.otherFiles.getFiles();
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
