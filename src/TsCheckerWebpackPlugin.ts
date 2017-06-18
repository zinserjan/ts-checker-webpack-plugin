import { Compiler } from "webpack";
import TsChecker, { TsCheckerResult } from "./TsChecker";
import { BaseError } from "./util/Error";
import { stripLoader } from "./util/webpackModule";

export interface TsCheckerWebpackPluginOptions {
  block?: boolean;
  tsconfigPath: string;
  tslintPath?: string;
}

export default class TsCheckerWebpackPlugin {
  watchMode: boolean = false;
  compiler: Compiler;
  checker: TsChecker;
  current?: Promise<TsCheckerResult> | null = null;

  constructor(options: TsCheckerWebpackPluginOptions) {
    this.checker = new TsChecker(options.tsconfigPath, options.tslintPath);
  }

  apply(compiler: Compiler) {
    this.compiler = compiler;

    // detect watch mode
    this.compiler.plugin("watch-run", (watching, callback) => {
      this.watchMode = true;
      callback();
    });

    // compilation almost finished, start type checking
    this.compiler.plugin("after-compile", (compilation, callback) => {
      // Don't run on child compilations
      if (compilation.compiler.isChild()) {
        callback();
        return;
      }

      // todo check for unix like file paths
      const buildFiles = compilation.modules
        .filter((module: any) => module.built && module.request)
        .map((module: any) => stripLoader(module.request));

      this.checker.updateBuiltFiles(buildFiles);

      // skip type checking when there are any build errors
      if (compilation.errors.length > 0) {
        callback();
        return;
      }

      // start type checking
      this.triggerStart();
      this.current = this.checker.check();
      this.registerBlockingCheckHook(this.current, compilation, callback);
    });

    // let webpack watch type definition files which are not part of the dependency graph
    // to rebuild on changes automatically
    compiler.plugin("emit", (compilation, callback) => {
      const filesToWatch = this.checker.getTypeCheckRelatedFiles();
      Array.prototype.push.apply(compilation.fileDependencies, filesToWatch);
      callback();
    });

    // compilation completely done, kill type checker in build mode
    this.compiler.plugin("done", () => {
      if (this.watchMode) {
        // wait for next tick until the watcher is ready
        process.nextTick(() => {
          // register change listener to watcher
          const watchFileSystem = (this.compiler as any).watchFileSystem;
          // extract watcher from NodeWatchFileSystem or IgnoringWatchFileSystem
          const watcher = watchFileSystem.watcher || (watchFileSystem.wfs && watchFileSystem.wfs.watcher);
          if (watcher != null) {
            // register change listener to get changed & removed files
            watcher.once("aggregated", (changes: Array<string>, removals: Array<string>) => {
              // update file cache
              this.checker.invalidateFiles(changes, removals);
            });
          }
        });
      }
    });
  }

  private registerBlockingCheckHook(current: Promise<TsCheckerResult>, compilation: any, callback: Function) {
    current
      .then((result: TsCheckerResult) => {
        const { errors, warnings } = TsCheckerWebpackPlugin.transformToWebpackBuildResult(result);
        errors.forEach(error => compilation.errors.push(error));
        warnings.forEach(error => compilation.warnings.push(error));
        this.triggerDone(errors, warnings);
        callback();
      })
      .catch(e => {
        this.triggerDone([e]);
        callback(e);
      });
  }

  private static transformToWebpackBuildResult(result: TsCheckerResult) {
    console.log("time", result.time + "ms");

    // todo maybe prefer diagnostic error for files with type & lint error
    const allErrors: Array<BaseError> = ([] as Array<BaseError>).concat(result.lints, result.diagnostics);
    const errors: Array<Error> = allErrors.filter(e => !e.isWarningSeverity());
    const warnings: Array<Error> = allErrors.filter(e => e.isWarningSeverity());

    return {
      errors,
      warnings,
    };
  }

  private triggerStart() {
    this.compiler.applyPlugins("ts-checker-webpack-plugin-start");
  }

  private triggerDone(errors: Array<Error>, warnings: Array<Error> = []) {
    const stats = {
      errors,
      warnings,
    };
    this.compiler.applyPlugins("ts-checker-webpack-plugin-done", stats);
  }
}
