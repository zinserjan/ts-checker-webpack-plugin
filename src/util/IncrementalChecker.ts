import * as path from "path";
import * as ts from "typescript";
import * as tslint from "tslint";
import { SourceFile } from "typescript";
import FileCache from "./FileCache";
import { DiagnosticError, LintError } from "./Error";

export default class IncrementalChecker {
  private fileCache: FileCache;
  private program: ts.Program;
  private programConfig: ts.ParsedCommandLine;
  private tslintConfig: tslint.Configuration.IConfigurationFile;

  constructor(tsconfigPath: string, tslintPath?: string) {
    this.fileCache = new FileCache();
    this.programConfig = IncrementalChecker.getProgramConfig(tsconfigPath);
    if (tslintPath != null) {
      this.tslintConfig = IncrementalChecker.getLintConfig(tslintPath);
    }
  }

  run() {
    this.program = this.createProgram(this.program);

    // check only files that were required by webpack
    const filesToCheck: Array<SourceFile> = this.program
      .getSourceFiles()
      .filter((file: SourceFile) => this.fileCache.isFileTypeCheckable(file.fileName)); // this makes it fast

    const diagnostics: Array<ts.Diagnostic> = [];
    filesToCheck.forEach(file => Array.prototype.push.apply(diagnostics, this.program.getSemanticDiagnostics(file)));

    const lints: Array<tslint.RuleFailure> = [];
    if (this.tslintConfig != null) {
      const filesToLint = filesToCheck.filter((file: SourceFile) => this.fileCache.isFileLintable(file.fileName));

      const linter = new tslint.Linter({ fix: false }, this.program);

      // lint files
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
          console.log("mark as linted");
          this.fileCache.linted(file.fileName);
        }
      });
    }

    return {
      diagnostics: diagnostics.map(DiagnosticError.createFromDiagnostic),
      lints: lints.map(LintError.createFromLint),
    };
  }

  updateBuiltFiles(changes: Array<string>) {
    changes.forEach(file => {
      this.fileCache.built(file);
      // remove type definitions for files like css-modules, cause file watcher may detect changes to late
      this.fileCache.removeTypeDefinitionOfFile(file);
    });
  }

  invalidateFiles(changed: Array<string>, removed: Array<string>) {
    // todo prefill cache for invalidated files to get another performance boost
    changed.forEach(file => {
      this.fileCache.invalidate(file);
      // remove type definitions for files like css-modules, cause file watcher may detect changes to late
      this.fileCache.removeTypeDefinitionOfFile(file);
    });

    removed.forEach(file => {
      this.fileCache.remove(file);
      // remove type definitions for files like css-modules, cause file watcher may detect changes to late
      this.fileCache.removeTypeDefinitionOfFile(file);
    });
  }

  getTypeCheckRelatedFiles() {
    return this.fileCache.getTypeCheckRelatedFiles();
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
    return tslint.Configuration.loadConfigurationFromPath(tslintPath);
  }
}
