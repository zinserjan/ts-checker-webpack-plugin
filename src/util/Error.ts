import Es6Error = require("es6-error");
import { Diagnostic, DiagnosticCategory, flattenDiagnosticMessageText } from "typescript";
import { RuleFailure } from "tslint";

export interface BaseError extends Error {
  severity: string;
  file: string;
  line: number;
  character: number;
  isWarningSeverity(): boolean;
}

export class DiagnosticError extends Es6Error implements BaseError {
  code: number;
  severity: string;
  file: string;
  line: number;
  character: number;

  // see https://github.com/gotwarlost/istanbul/issues/690
  /* istanbul ignore next */
  constructor(message: string, code: number, severity: string, file: string, line: number, character: number) {
    super(message);
    this.code = code;
    this.severity = severity;
    this.file = file;
    this.line = line;
    this.character = character;
  }

  isWarningSeverity() {
    return this.severity === "warning";
  }

  static createFromDiagnostic(diagnostic: Diagnostic) {
    const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return new DiagnosticError(
      flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      diagnostic.code,
      DiagnosticCategory[diagnostic.category].toLowerCase(),
      diagnostic.file.fileName,
      position.line,
      position.character
    );
  }
}

export class LintError extends Es6Error implements BaseError {
  rule: string;
  severity: string;
  file: string;
  line: number;
  character: number;

  // see https://github.com/gotwarlost/istanbul/issues/690
  /* istanbul ignore next */
  constructor(message: string, rule: string, severity: string, file: string, line: number, character: number) {
    super(message);
    this.rule = rule;
    this.severity = severity;
    this.file = file;
    this.line = line;
    this.character = character;
  }

  isWarningSeverity() {
    return this.severity === "warning";
  }

  static createFromLint(lint: RuleFailure) {
    const position = lint.getStartPosition().getLineAndCharacter();
    return new LintError(
      lint.getFailure(),
      lint.getRuleName(),
      lint.getRuleSeverity(),
      lint.getFileName(),
      position.line,
      position.character
    );
  }
}
