import { DiagnosticError } from "./util/Error";
import IncrementalChecker from "./util/IncrementalChecker";

export type TsCheckerResult = {
  diagnostics: Array<DiagnosticError>;
  lints: Array<DiagnosticError>;
  time: number;
};

export default class TsChecker {
  private incrementalChecker: IncrementalChecker;

  constructor(tsconfigPath: string) {
    this.incrementalChecker = new IncrementalChecker(tsconfigPath);
  }

  /**
   * Checks type checking and linting
   */
  check(): Promise<TsCheckerResult> {
    const start = Date.now();

    return Promise.resolve().then(() => {
      const { diagnostics, lints } = this.incrementalChecker.run();
      return {
        diagnostics,
        lints,
        time: Date.now() - start,
      };
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
}
