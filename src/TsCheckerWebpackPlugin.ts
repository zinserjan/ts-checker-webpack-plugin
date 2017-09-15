import { Compiler } from "webpack";
import TsCheckerWorker from "./worker/TsCheckerWorker";
import Logger from "./util/Logger";
import { stripLoader } from "./util/webpackModule";
import { WebpackBuildResult } from "./checker/resultSerializer";

export interface TsCheckerWebpackPluginOptions {
  tsconfig: string;
  tslint?: string;
  memoryLimit?: number;
  timings?: boolean;
  diagnosticFormatter?: string;
}

class TsCheckerWebpackPlugin {
  private watchMode: boolean = false;
  private compiler: Compiler;
  private logger: Logger;
  private checker: TsCheckerWorker;
  private current: Promise<WebpackBuildResult | void> | null = null;
  private builtFiles: Array<string> = [];
  private startTime: number = Date.now();

  constructor(options: TsCheckerWebpackPluginOptions) {
    const { tsconfig, tslint, memoryLimit = 512, timings = false, diagnosticFormatter = "ts-loader" } = options;
    this.logger = new Logger();
    if (timings) {
      this.logger.enable();
    }
    this.checker = new TsCheckerWorker(memoryLimit, timings, tsconfig, diagnosticFormatter, tslint);
    this.checker.start();
  }

  apply(compiler: Compiler) {
    this.compiler = compiler;

    const lastTimes: Map<string, number> = new Map<string, number>();
    // detect watch mode
    this.compiler.plugin("watch-run", (watching, callback) => {
      this.watchMode = true;

      this.logger.time("ts-checker-webpack-plugin:determine-changed-files");
      const currentTimes = watching.compiler.fileTimestamps;
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
      this.logger.time("ts-checker-webpack-plugin:wait-for-file-invalidation");
      if (this.current !== null) {
        this.current
          .then(() => {
            this.logger.timeEnd("ts-checker-webpack-plugin:wait-for-file-invalidation");
            callback();
          })
          .catch(callback);
        this.current = null;
      } else {
        this.logger.timeEnd("ts-checker-webpack-plugin:wait-for-file-invalidation");
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
        const buildFiles = compilation.modules
          .filter((module: any) => module.built && module.request)
          .map((module: any) => stripLoader(module.request));

        Array.prototype.push.apply(this.builtFiles, buildFiles);

        // skip type checking when already checked or when there are build errors
        if (checked || compilation.errors.length > 0) {
          return;
        }

        // start type checking
        this.logger.timeEnd("ts-checker-webpack-plugin:wait-for-built-of-modules");
        this.logger.time("ts-checker-webpack-plugin:type-checking-process");
        this.current = this.checker.check(this.builtFiles);
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
          // reset built files
          this.builtFiles.length = 0;
          // pass errors/warnings to webpack
          const { errors, warnings } = result;
          errors.forEach((error: Error) => compilation.errors.push(error));
          warnings.forEach((error: Error) => compilation.warnings.push(error));
        })
        .then(() => {
          this.logger.time("ts-checker-webpack-plugin:wait-for-type-checker:files");
          return this.checker.getTypeCheckRelatedFiles();
        })
        .then(filesToWatch => {
          this.logger.timeEnd("ts-checker-webpack-plugin:wait-for-type-checker:files");
          // let webpack watch type definition files which are not part of the dependency graph
          // to rebuild on changes automatically
          Array.prototype.push.apply(compilation.fileDependencies, filesToWatch);
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
