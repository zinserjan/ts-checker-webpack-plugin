import { fork, ChildProcess } from "child_process";
import { DiagnosticError, LintError } from "./util/Error";
import { TsCheckerResult } from "./util/IncrementalChecker";
import pDefer = require("p-defer");

export default class TsChecker {
  private process: ChildProcess | null = null;
  private memoryLimit: number;
  private tsconfigPath: string;
  private tslintPath?: string;
  private exitListener: () => void;

  constructor(memoryLimit: number, tsconfigPath: string, tslintPath?: string) {
    this.memoryLimit = memoryLimit;
    this.tsconfigPath = tsconfigPath;
    this.tslintPath = tslintPath;
    this.exitListener = () => {
      if (this.process != null) {
        this.process.kill();
      }
    };
  }

  /**
   * Starts the checker process
   */
  start() {
    if (this.process == null) {
      // terminate children when main process is going to die
      process.on("exit", this.exitListener);

      // start child process
      this.process = fork(
        process.env.TS_CHECKER_ENV === "test"
          ? require.resolve("ts-node/dist/_bin")
          : require.resolve("./TsCheckerService"),
        process.env.TS_CHECKER_ENV === "test" ? [require.resolve("./TsCheckerService")] : [],
        {
          cwd: process.cwd(),
          execArgv: [`--max-old-space-size=${this.memoryLimit}`],
          env: {
            TSCONFIG: this.tsconfigPath,
            ...this.tslintPath ? { TSLINT: this.tslintPath } : {},
          },
          stdio: ["inherit", "inherit", "inherit", "ipc"],
        }
      );

      this.process.on("error", err => {
        throw err;
      });
    }
  }

  /**
   * Kills the checker process
   */
  kill() {
    if (this.process != null) {
      process.removeListener("exit", this.exitListener);
      this.process.removeAllListeners();
      this.process.kill();
      this.process = null;
    }
  }

  /**
   * Pass files that were (re-)built by webpack and start type checking and linting
   */
  check(files: Array<string>): Promise<TsCheckerResult> {
    this.start();
    return this.sendAndWait("typeCheck", { files }).then((result: any) => {
      return {
        ...result,
        lints: result.lints.map(LintError.fromJSON),
        diagnostics: result.diagnostics.map(DiagnosticError.fromJSON),
      } as TsCheckerResult;
    });
  }

  /**
   * Invalidate all files that were changed in general (also non-webpack modules)
   */
  invalidateFiles(changes: Array<string>, removals: Array<string>) {
    this.start();
    return this.sendAndWait("invalidateFiles", { changes, removals }).then(() => undefined);
  }

  /**
   * Recevices all files that are relevant for type checking but unknown for webpack
   */
  getTypeCheckRelatedFiles() {
    this.start();
    return this.sendAndWait("typeCheckRelatedFiles").then(({ files }) => files);
  }

  private sendAndWait(id: string, options: { [key: string]: any } = {}) {
    const deferred = pDefer<any>();

    (this.process as ChildProcess).once("message", deferred.resolve);
    (this.process as ChildProcess).send({
      id,
      ...options,
    });
    return deferred.promise;
  }
}
