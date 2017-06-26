import { Compiler } from "webpack";
import TsChecker from "./TsChecker";
import { stripLoader } from "./util/webpackModule";
import { WebpackBuildResult } from "./util/resultSerializer";

export interface TsCheckerWebpackPluginOptions {
  tsconfig: string;
  tslint?: string;
  memoryLimit?: number;
  diagnosticFormatter?: string;
}

export default class TsCheckerWebpackPlugin {
  private watchMode: boolean = false;
  private compiler: Compiler;
  private checker: TsChecker;
  private current: Promise<WebpackBuildResult | void> | null = null;
  private builtFiles: Array<string> = [];

  constructor(options: TsCheckerWebpackPluginOptions) {
    const { tsconfig, tslint, memoryLimit = 512, diagnosticFormatter = "ts-loader" } = options;
    this.checker = new TsChecker(memoryLimit, tsconfig, diagnosticFormatter, tslint);
    this.checker.start();
  }

  apply(compiler: Compiler) {
    this.compiler = compiler;

    // detect watch mode
    this.compiler.plugin("watch-run", (watching, callback) => {
      this.watchMode = true;
      callback();
    });

    // wait until all changed files are invalidated
    this.compiler.plugin("make", (compilation, callback) => {
      // Don't run on child compilations & skip for build mode
      if (compilation.compiler.isChild() || !this.watchMode) {
        callback();
        return;
      }
      // wait for next tick to make sure that the synchronous "aggregated" event was called before
      process.nextTick(() => {
        if (this.current !== null) {
          this.current.then(() => callback()).catch(callback);
          this.current = null;
        } else {
          callback();
        }
      });
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

        Array.prototype.push.apply(this.builtFiles, buildFiles);

        // skip type checking when there are build errors
        if (compilation.errors.length > 0) {
          this.current = null;
          return;
        }

        // start type checking
        this.current = this.checker.check(this.builtFiles);
      });
    });

    this.compiler.plugin("after-emit", (compilation, callback) => {
      // Don't run on child compilations
      if (compilation.compiler.isChild() || this.current == null) {
        callback();
        return;
      }

      // block emit until type checking is ready
      (this.current as Promise<WebpackBuildResult>)
        .then((result: any) => {
          // reset built files
          this.builtFiles.length = 0;
          // pass errors/warnings to webpack
          const { errors, warnings } = result;
          errors.forEach((error: Error) => compilation.errors.push(error));
          warnings.forEach((error: Error) => compilation.warnings.push(error));
        })
        .then(() => this.checker.getTypeCheckRelatedFiles())
        .then(filesToWatch => {
          // let webpack watch type definition files which are not part of the dependency graph
          // to rebuild on changes automatically
          Array.prototype.push.apply(compilation.fileDependencies, filesToWatch);
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
      } else {
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
              this.current = this.checker.invalidateFiles(changes, removals);
            });
          }
        });
      }
    });

    // kill checker when webpack watch compiler was closed
    this.compiler.plugin("watch-close", () => {
      this.checker.kill();
    });
  }
}
