import * as path from "path";
import * as ts from "typescript";
import { SourceFile } from "typescript";
import * as Watcher from "watchpack";
import FileCache from "./FileCache";
import { DiagnosticError } from "./Error";

const NODE_MODULE = /node_modules/;
const TYPE_DEFINITION = /.*\.d\.ts$/;

export default class IncrementalChecker {
  /**
   * Files which are handled by webpack -> cache invalidation is handled by webpack
   */
  webpackFiles: FileCache;
  /**
   * Type definitions files from node_modules -> just cache them forever
   */
  libFiles: FileCache;
  /**
   * Other src & type definition files related only for type checking -> needs to invalidated with custom watcher
   */
  otherFiles: FileCache;
  program: ts.Program;
  programConfig: ts.ParsedCommandLine;
  watchMode: boolean = false;
  watchOptions: {} = {};
  watcher: null | Watcher = null;
  lastCheck: number = Date.now();

  constructor(tsconfigPath: string) {
    this.webpackFiles = new FileCache();
    this.libFiles = new FileCache();
    this.otherFiles = new FileCache();
    this.programConfig = IncrementalChecker.getProgramConfig(tsconfigPath);
  }

  run() {
    this.program = this.createProgram();
    this.lastCheck = Date.now();

    // check only files that were required by webpack and ignore files under node_modules
    let filesToCheck: Array<SourceFile> = this.program
      .getSourceFiles()
      .filter((file: SourceFile) => this.webpackFiles.exist(file.fileName) && !NODE_MODULE.test(file.fileName)); // this makes it fast

    const diagnostics: Array<ts.Diagnostic> = [];
    filesToCheck.forEach(file => Array.prototype.push.apply(diagnostics, this.program.getSemanticDiagnostics(file)));

    if (this.watchMode) {
      this.restartWatchingNonWebpackFiles();
    }

    this.webpackFiles.allChecked();

    return {
      diagnostics: diagnostics.map(DiagnosticError.createFromDiagnostic),
      lints: [],
    };
  }

  invalidateFiles(changed: Array<string>, removed: Array<string>) {
    // todo prefill cache for invalidated files to get another performance boost
    changed.forEach(file => this.webpackFiles.invalidate(file));
    removed.forEach(file => this.webpackFiles.remove(file));
  }

  setWatchMode(enabled: boolean) {
    if (this.watchMode !== enabled) {
      this.watchMode = enabled;
      if (this.watchMode) {
        this.restartWatchingNonWebpackFiles();
      } else {
        this.stopWatchingNonWebpackFiles();
      }
    }
  }

  setWatchOptions(watchOptions: {}) {
    this.watchOptions = watchOptions;
  }

  private createProgram() {
    const host = ts.createCompilerHost(this.programConfig.options);
    const originalGetSourceFile = host.getSourceFile;

    host.getSourceFile = (filePath, languageVersion, onError): SourceFile => {
      // get source file only if there is no source in files register
      if (this.webpackFiles.exist(filePath)) {
        if (this.webpackFiles.getSource(filePath) === null) {
          this.webpackFiles.add(filePath, originalGetSourceFile(filePath, languageVersion, onError));
        }
        return this.webpackFiles.getSource(filePath) as SourceFile;
      } else if (NODE_MODULE.test(filePath) && TYPE_DEFINITION.test(filePath)) {
        if (this.libFiles.getSource(filePath) === null) {
          this.libFiles.add(filePath, originalGetSourceFile(filePath, languageVersion, onError));
        }
        return this.libFiles.getSource(filePath) as SourceFile;
      }
      if (!this.otherFiles.exist(filePath) || this.otherFiles.getSource(filePath) === null) {
        this.otherFiles.add(filePath, originalGetSourceFile(filePath, languageVersion, onError));
      }
      return this.otherFiles.getSource(filePath) as SourceFile;
    };

    return ts.createProgram(this.programConfig.fileNames, this.programConfig.options, host, this.program);
  }

  private static getProgramConfig(tsconfigPath: string) {
    const config = ts.readConfigFile(tsconfigPath, ts.sys.readFile).config;
    return ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(tsconfigPath));
  }

  private restartWatchingNonWebpackFiles() {
    this.stopWatchingNonWebpackFiles();

    const files = this.otherFiles.getFiles();
    if (files.length > 0) {
      this.watcher = new Watcher(this.watchOptions);
      this.watcher.watch(files, [], this.lastCheck);

      this.watcher.on("change", (file: string) => {
        this.otherFiles.invalidate(file);
      });

      this.watcher.on("remove", (file: string) => {
        this.otherFiles.remove(file);
      });
    }
  }

  private stopWatchingNonWebpackFiles() {
    if (this.watcher != null) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
