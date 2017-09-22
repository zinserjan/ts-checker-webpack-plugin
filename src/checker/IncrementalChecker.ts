import * as path from "path";
import * as ts from "typescript";
import tslintTypes = require("tslint"); // Only imported for types, tslint will be required lazy
import { SourceFile, Diagnostic } from "typescript";
import normalizePath = require("normalize-path");
import FileCache from "../util/FileCache";
import Logger from "../util/Logger";

export type TsCheckerResult = {
  checkTime: number;
  lintTime: number;
  diagnostics: Array<Diagnostic>;
  lints: Array<tslintTypes.RuleFailure>;
};

export default class IncrementalChecker {
  private logger: Logger;
  private fileCache: FileCache;
  private program: ts.Program;
  private programConfig: ts.ParsedCommandLine;
  private tslintConfig: tslintTypes.Configuration.IConfigurationFile;

  constructor(timings: boolean, tsconfigPath: string, tslintPath?: string) {
    this.logger = new Logger();
    this.fileCache = new FileCache();
    this.programConfig = IncrementalChecker.getProgramConfig(tsconfigPath);
    if (tslintPath != null) {
      this.tslintConfig = IncrementalChecker.getLintConfig(tslintPath);
    }
    if (timings) {
      this.logger.enable();
    }
  }

  run(): TsCheckerResult {
    const checkStart = Date.now();
    this.logger.time("ts-checker-webpack-plugin:create-program");
    this.program = this.createProgram(this.program);
    this.logger.timeEnd("ts-checker-webpack-plugin:create-program");

    // check only files that were required by webpack
    this.logger.time("ts-checker-webpack-plugin:collect-sourcefiles");
    const filesToCheck: Array<SourceFile> = this.program.getSourceFiles();
    this.logger.timeEnd("ts-checker-webpack-plugin:collect-sourcefiles");

    this.logger.time("ts-checker-webpack-plugin:check-types");
    const diagnostics: Array<ts.Diagnostic> = [];
    filesToCheck.forEach(file => Array.prototype.push.apply(diagnostics, this.program.getSemanticDiagnostics(file)));
    this.logger.timeEnd("ts-checker-webpack-plugin:check-types");
    const checkEnd = Date.now();

    const lintStart = Date.now();
    const lints: Array<tslintTypes.RuleFailure> = [];
    if (this.tslintConfig != null) {
      this.logger.time("ts-checker-webpack-plugin:create-linter");
      const tslint: typeof tslintTypes = require("tslint");
      const linter = new tslint.Linter({ fix: false }, this.program);
      this.logger.timeEnd("ts-checker-webpack-plugin:create-linter");

      this.logger.time("ts-checker-webpack-plugin:collect-lintfiles");
      const filesToLint = filesToCheck.filter((file: SourceFile) => this.fileCache.isFileLintable(file.fileName));
      this.logger.timeEnd("ts-checker-webpack-plugin:collect-lintfiles");

      // lint files
      this.logger.time("ts-checker-webpack-plugin:lint-files");
      filesToLint.forEach((file: SourceFile) => {
        linter.lint(file.fileName, file.text, this.tslintConfig);
      });

      // collect failed files
      const failed = new Map<string, boolean>();
      linter.getResult().failures.forEach(lintResult => {
        lints.push(lintResult);
        failed.set(lintResult.getFileName(), true);
      });

      // track files without errors as linted
      filesToLint.forEach((file: SourceFile) => {
        if (!failed.has(file.fileName)) {
          this.fileCache.linted(file.fileName);
        }
      });
      this.logger.timeEnd("ts-checker-webpack-plugin:lint-files");
    }
    const lintEnd = Date.now();

    return {
      checkTime: checkEnd - checkStart,
      lintTime: lintEnd - lintStart,
      diagnostics,
      lints,
    };
  }

  updateBuiltFiles(changes: Array<string>) {
    changes.forEach(file => {
      // normalize system path style to unix style
      const normalizedFile = normalizePath(file);
      // invalidate file
      this.fileCache.built(normalizedFile);
      // remove type definitions for files like css-modules, cause file watcher may detect changes to late
      this.fileCache.removeTypeDefinitionOfFile(normalizedFile);
    });
  }

  invalidateFiles(changed: Array<string>, removed: Array<string>) {
    // todo prefill cache for invalidated files to get another performance boost
    changed.forEach(file => {
      // normalize system path style to unix style
      const normalizedFile = normalizePath(file);
      // invalidate file
      this.fileCache.invalidate(normalizedFile);
      // remove type definitions for files like css-modules, cause file watcher may detect changes to late
      this.fileCache.removeTypeDefinitionOfFile(normalizedFile);
    });

    removed.forEach(file => {
      // normalize system path style to unix style
      const normalizedFile = normalizePath(file);
      // remove file
      this.fileCache.remove(normalizedFile);
      // remove type definitions for files like css-modules, cause file watcher may detect changes to late
      this.fileCache.removeTypeDefinitionOfFile(normalizedFile);
    });
  }

  getTypeCheckRelatedFiles() {
    const files = this.fileCache.getTypeCheckRelatedFiles();
    // re-normalize unix path style to system style
    return files.map(file => path.normalize(file));
  }

  private createProgram(oldProgram: ts.Program) {
    const host = ts.createCompilerHost(this.programConfig.options);
    const originalGetSourceFile = host.getSourceFile;

    host.getSourceFile = (filePath, languageVersion, onError): SourceFile => {
      // try to read file from cache
      const source = this.fileCache.getSource(filePath);
      if (source !== null) {
        return source;
      }

      // get source from file as files cache isn't prefilled yet
      this.fileCache.add(filePath, originalGetSourceFile(filePath, languageVersion, onError));
      return this.fileCache.getSource(filePath) as SourceFile;
    };

    return ts.createProgram(this.programConfig.fileNames, this.programConfig.options, host, oldProgram);
  }

  private static getProgramConfig(tsconfigPath: string) {
    const config = ts.readConfigFile(tsconfigPath, ts.sys.readFile).config;
    return ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(tsconfigPath));
  }

  private static getLintConfig(tslintPath: string) {
    const tslint: typeof tslintTypes = require("tslint");
    return tslint.Configuration.loadConfigurationFromPath(tslintPath);
  }
}
