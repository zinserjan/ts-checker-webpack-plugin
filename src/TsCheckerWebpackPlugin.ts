import { Compiler } from "webpack";
import PCancelable = require("p-cancelable");
import TsChecker, { TsCheckerResult } from "./TsChecker";
import { BaseError } from "./util/Error";

// const CancelError = PCancelable.CancelError;

export interface TsCheckerWebpackPluginOptions {
  block?: boolean;
  tsconfigPath: string;
  tslintPath?: string;
}

export default class TsCheckerWebpackPlugin {
  block: boolean = true;
  watchMode: boolean = false;
  compiler: Compiler;
  checker: TsChecker;
  current?: PCancelable<TsCheckerResult> | null = null;

  constructor(options: TsCheckerWebpackPluginOptions) {
    this.block = true; // todo configure via config
    this.checker = new TsChecker(options.tsconfigPath);
  }

  apply(compiler: Compiler) {
    this.compiler = compiler;

    // detect watch mode
    this.compiler.plugin("watch-run", (watching, callback) => {
      this.watchMode = true;
      this.checker.setWatchMode(true);
      callback();
    });

    // detect when watch-mode is over
    this.compiler.plugin("watch-close", () => {
      this.watchMode = false;
      this.checker.setWatchMode(false);
    });

    // new compilation started, abort any existing type checkings
    // this.compiler.plugin('before-compile', (i, callback) => {
    //   // abort any existing stuff
    //   if (this.current != null) {
    //     this.current.cancel();
    //   }
    //   callback();
    // });

    // compilation almost finished, start type checking
    this.compiler.plugin("after-compile", (compilation, callback) => {
      // Don't run on child compilations
      if (compilation.compiler.isChild()) {
        callback();
        return;
      }

      const stripLoader = (filePath: string) => {
        const lastIndex = filePath.lastIndexOf("!");

        if (lastIndex !== -1) {
          return filePath.substr(lastIndex + 1);
        }
        return filePath;
      };

      // todo check for unix like file paths
      const buildFiles = compilation.modules
        .filter((module: any) => module.built && module.request)
        .map((module: any) => stripLoader(module.request));

      this.checker.invalidate(buildFiles, []);

      // start type checking
      this.triggerStart();
      this.current = this.checker.check();

      // if (this.block) {
      this.registerBlockingCheckHook(this.current, compilation, callback);
      // } else {
      //   this.registerNonBlockingCheckHook(this.current);
      //   callback();
      // }
    });

    // compilation completely done, kill type checker in build mode
    this.compiler.plugin("done", () => {
      if (!this.watchMode) {
        this.checker.kill();
      } else {
        // wait for next tick until the watcher is ready
        process.nextTick(() => {
          // register change listener to watcher
          const watchFileSystem = (this.compiler as any).watchFileSystem;
          // extract watcher from NodeWatchFileSystem or IgnoringWatchFileSystem
          const watcher = watchFileSystem.watcher || (watchFileSystem.wfs && watchFileSystem.wfs.watcher);
          if (watcher != null) {
            // extract watch options from watcher
            this.refreshWatchOptions(Object.assign({}, watcher.options));
            // register change listener to get changed & removed files
            watcher.once("aggregated", (changes: Array<string>, removals: Array<string>) => {
              // update file cache
              this.checker.invalidate(changes, removals);
            });
          }
        });
      }
    });
  }

  private registerBlockingCheckHook(current: PCancelable<TsCheckerResult>, compilation: any, callback: Function) {
    current
      .then((result: TsCheckerResult) => {
        const { errors, warnings } = TsCheckerWebpackPlugin.transformToWebpackBuildResult(result);
        errors.forEach(error => compilation.errors.push(error));
        // warnings.forEach((error) => compilation.warnings.push(error));
        this.triggerDone(errors, warnings);
        callback();
      })
      .catch(e => {
        this.triggerDone([e]);
        callback(e);
      });
  }

  // private registerNonBlockingCheckHook(current: PCancelable<TsCheckerResult>) {
  //   current
  //     .then((result: TsCheckerResult) => {
  //       const { errors, warnings } = TsCheckerWebpackPlugin.transformToWebpackBuildResult(result);
  //       this.triggerDone(errors, warnings);
  //     })
  //     .catch((e) => {
  //       if (e instanceof CancelError) {
  //         // type checking was already canceled, just ignore this,
  //         return;
  //       }
  //       this.triggerDone([e]);
  //     })
  // }

  private static transformToWebpackBuildResult(result: TsCheckerResult) {
    console.log("time", result.time + "ms");

    const allErrors: Array<BaseError> = ([] as Array<BaseError>).concat(result.lints, result.diagnostics);
    const errors: Array<Error> = allErrors.filter(e => !e.isWarningSeverity());
    const warnings: Array<Error> = allErrors.filter(e => e.isWarningSeverity());

    return {
      errors,
      warnings,
    };
  }

  private refreshWatchOptions(watchOptions: {}) {
    this.checker.setWatchOptions(watchOptions);
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
