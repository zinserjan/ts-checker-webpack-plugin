import { Compiler } from "webpack";
import TsChecker, { TsCheckerResult } from "./TsChecker";
import { BaseError } from "./util/Error";
import { stripLoader } from "./util/webpackModule";

export interface TsCheckerWebpackPluginOptions {
  tsconfig: string;
  tslint?: string;
}

export default class TsCheckerWebpackPlugin {
  private watchMode: boolean = false;
  private compiler: Compiler;
  private checker: TsChecker;
  private current?: Promise<TsCheckerResult> | null = null;

  constructor(options: TsCheckerWebpackPluginOptions) {
    this.checker = new TsChecker(options.tsconfig, options.tslint);
  }

  apply(compiler: Compiler) {
    this.compiler = compiler;

    // detect watch mode
    this.compiler.plugin("watch-run", (watching, callback) => {
      this.watchMode = true;
      callback();
    });

    this.compiler.plugin("compilation", compilation => {
      // Don't run on child compilations
      if (compilation.compiler.isChild()) {
        return;
      }

      this.current = null;

      // compilation for modules almost finished, start type checking
      compilation.plugin("seal", () => {
        const buildFiles = compilation.modules
          .filter((module: any) => module.built && module.request)
          .map((module: any) => stripLoader(module.request));

        this.checker.updateBuiltFiles(buildFiles);

        // skip type checking when there are build errors
        if (compilation.errors.length > 0) {
          return;
        }

        // start type checking
        this.current = this.checker.check();
      });
    });

    this.compiler.plugin("emit", (compilation, callback) => {
      // Don't run on child compilations
      if (compilation.compiler.isChild() || this.current == null) {
        callback();
        return;
      }

      // block emit until type checking is ready
      this.current
        .then((result: TsCheckerResult) => {
          // let webpack watch type definition files which are not part of webpack's dependency graph
          // to rebuild on changes automatically
          const filesToWatch = this.checker.getTypeCheckRelatedFiles();
          Array.prototype.push.apply(compilation.fileDependencies, filesToWatch);

          // pass errors/warnings to webpack
          const { errors, warnings } = TsCheckerWebpackPlugin.transformToWebpackBuildResult(result);
          errors.forEach(error => compilation.errors.push(error));
          warnings.forEach(error => compilation.warnings.push(error));
          callback();
        })
        .catch(e => {
          callback(e);
        });
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

  private static transformToWebpackBuildResult(result: TsCheckerResult) {
    // todo maybe prefer diagnostic error for files with type & lint error
    const allErrors: Array<BaseError> = ([] as Array<BaseError>).concat(result.lints, result.diagnostics);
    const errors: Array<Error> = allErrors.filter(e => !e.isWarningSeverity());
    const warnings: Array<Error> = allErrors.filter(e => e.isWarningSeverity());

    return {
      errors,
      warnings,
    };
  }
}
