import { Compiler } from "webpack";
import TsCheckerWorker from "./worker/TsCheckerWorker";
import Logger from "./util/Logger";
import { WebpackBuildResult } from "./checker/resultSerializer";

export interface TsCheckerWebpackPluginOptions {
  incremental?: boolean;
  tsconfig: string;
  tslint?: string;
  tslintEmitErrors?: boolean;
  memoryLimit?: number;
  timings?: boolean;
  diagnosticFormatter?: string;
  ignoreDiagnostics?: Array<number>;
  ignoreLints?: Array<string>;
}

class TsCheckerWebpackPlugin {
  private watchMode: boolean = false;
  private compiler: Compiler;
  private logger: Logger;
  private checker: TsCheckerWorker;
  private current: Promise<WebpackBuildResult | void> | null = null;
  private startTime: number = Date.now();

  constructor(options: TsCheckerWebpackPluginOptions) {
    const {
      incremental = true,
      tsconfig,
      tslint,
      tslintEmitErrors = false,
      memoryLimit = 512,
      timings = false,
      diagnosticFormatter = "ts-loader",
      ignoreDiagnostics = [],
      ignoreLints = [],
    } = options;
    this.logger = new Logger();
    if (timings) {
      this.logger.enable();
    }
    this.checker = new TsCheckerWorker(
      incremental,
      memoryLimit,
      timings,
      tsconfig,
      diagnosticFormatter,
      ignoreDiagnostics,
      ignoreLints,
      tslintEmitErrors,
      tslint
    );
  }

  apply(compiler: Compiler) {
    this.compiler = compiler;

    const lastTimes: Map<string, number> = new Map<string, number>();
    // build without watch-mode
    this.compiler.plugin("run", (_, callback) => {
      this.checker
        .start()
        .then(callback)
        .catch(callback);
    });

    // build with watch mode
    this.compiler.plugin("watch-run", (_, callback) => {
      this.watchMode = true;

      this.checker
        .start()
        .then(callback)
        .catch(callback);
    });

    // handle file invalidation
    this.compiler.plugin("before-compile", (_, callback) => {
      this.logger.time("ts-checker-webpack-plugin:determine-changed-files");
      const currentTimes = (this.compiler as any).fileTimestamps;
      // update file cache
      const changed: Array<string> = Object.keys(currentTimes)
        .filter(filePath => currentTimes[filePath] > (lastTimes.get(filePath) || this.startTime))
        .map(filePath => {
          lastTimes.set(filePath, currentTimes[filePath]);
          return filePath;
        });

      this.logger.timeEnd("ts-checker-webpack-plugin:determine-changed-files");
      this.current = this.checker.invalidateFiles(changed, []);
      callback();
    });

    // wait until all changed files are invalidated
    this.compiler.plugin("make", (compilation, callback) => {
      // Don't run on child compilations
      if (compilation.compiler.isChild()) {
        callback();
        return;
      }
      if (this.current !== null) {
        this.logger.time("ts-checker-webpack-plugin:wait-for-file-invalidation");
        this.current
          .then(() => {
            this.logger.timeEnd("ts-checker-webpack-plugin:wait-for-file-invalidation");
            callback();
          })
          .catch(callback);
        this.current = null;
      } else {
        callback();
      }
    });

    this.compiler.plugin("compilation", compilation => {
      // Don't run on child compilations
      if (compilation.compiler.isChild()) {
        return;
      }

      this.logger.time("ts-checker-webpack-plugin:wait-for-built-of-modules");
      let checked = false;

      // compilation for modules almost finished, start type checking
      compilation.plugin("seal", () => {
        // skip type checking when already checked or when there are build errors
        if (checked || compilation.errors.length > 0) {
          return;
        }

        // start type checking
        this.logger.timeEnd("ts-checker-webpack-plugin:wait-for-built-of-modules");
        this.logger.time("ts-checker-webpack-plugin:type-checking-process");
        this.current = this.checker.check();
        checked = true;
      });
    });

    this.compiler.plugin("after-emit", (compilation, callback) => {
      // Don't run on child compilations
      if (compilation.compiler.isChild() || this.current == null) {
        callback();
        return;
      }

      this.logger.time("ts-checker-webpack-plugin:wait-for-type-checker");
      this.logger.time("ts-checker-webpack-plugin:wait-for-type-checker:results");
      // block emit until type checking is ready
      (this.current as Promise<WebpackBuildResult>)
        .then((result: any) => {
          this.logger.timeEnd("ts-checker-webpack-plugin:wait-for-type-checker:results");
          // pass errors/warnings to webpack
          const { errors, warnings } = result;
          errors.forEach((error: Error) => compilation.errors.push(error));
          warnings.forEach((error: Error) => compilation.warnings.push(error));
        })
        .then(() => {
          this.logger.time("ts-checker-webpack-plugin:wait-for-type-checker:files");
          return this.checker.getTypeCheckRelatedFiles();
        })
        .then(filesToCheck => {
          // let webpack watch TypeScript files which are not part of the dependency graph
          // to rebuild on changes automatically
          const fileDependencies = new Set(compilation.fileDependencies);
          const filesToWatch = filesToCheck.filter(f => !fileDependencies.has(f));
          Array.prototype.push.apply(compilation.fileDependencies, filesToWatch);
          this.logger.timeEnd("ts-checker-webpack-plugin:wait-for-type-checker:files");
          this.logger.timeEnd("ts-checker-webpack-plugin:wait-for-type-checker");
          this.logger.timeEnd("ts-checker-webpack-plugin:type-checking-process");
        })
        .then(callback)
        .catch(callback);

      // reset promise
      this.current = null;
    });

    // compilation completely done, kill type checker in build mode
    this.compiler.plugin("done", () => {
      if (!this.watchMode) {
        this.checker.kill();
      }
    });

    // kill checker when webpack watch compiler was closed
    this.compiler.plugin("watch-close", () => {
      this.checker.kill();
    });
  }
}

// to generate type definitions
export default TsCheckerWebpackPlugin;
// to support CommonJS
module.exports = TsCheckerWebpackPlugin;
// to support ES6 default import
module.exports.default = module.exports;
