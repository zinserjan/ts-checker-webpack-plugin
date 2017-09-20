import { ChildProcess } from "child_process";
import { deserializeWebpackBuildResult, WebpackBuildResult } from "../checker/resultSerializer";
import pDefer = require("p-defer");
const supportsColor = require("supports-color");
import { TsCheckerRuntimeConfig } from "./TsCheckerRuntime";
import { forkProcess } from "./process";

export default class TsCheckerWorker {
  private process: ChildProcess | null = null;
  private memoryLimit: number;
  private exitListener: () => void;
  private runtimeConfig: TsCheckerRuntimeConfig;

  constructor(
    memoryLimit: number,
    timings: boolean,
    tsconfigPath: string,
    diagnosticFormatter: string,
    ignoreDiagnostics: Array<number>,
    ignoreLints: Array<string>,
    tslintEmitErrors: boolean,
    tslintPath?: string
  ) {
    this.memoryLimit = memoryLimit;
    this.runtimeConfig = {
      tsconfigPath,
      diagnosticFormatter,
      tslintPath,
      tslintEmitErrors,
      timings,
      ignoreDiagnostics,
      ignoreLints,
    };
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
      this.process = forkProcess(
        process.env.TS_CHECKER_ENV === "test"
          ? require.resolve("ts-node/dist/_bin")
          : require.resolve("./TsCheckerRuntime"),
        process.env.TS_CHECKER_ENV === "test" ? [require.resolve("./TsCheckerRuntime")] : [],
        {
          cwd: process.cwd(),
          execArgv: [`--max-old-space-size=${this.memoryLimit}`],
          env: {
            FORCE_COLOR: Number(supportsColor),
            TS_CHECKER_CONFIG: JSON.stringify(this.runtimeConfig),
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
  check(files: Array<string>): Promise<WebpackBuildResult> {
    this.start();
    return this.sendAndWait("typeCheck", { files }).then(deserializeWebpackBuildResult);
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
