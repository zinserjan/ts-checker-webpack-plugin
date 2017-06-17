import Es6Error = require("es6-error");
import {
  Diagnostic,
  DiagnosticCategory,
  flattenDiagnosticMessageText,
} from "typescript";

export interface BaseError extends Error {
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
  constructor(
    message: string,
    code: number,
    severity: string,
    file: string,
    line: number,
    character: number
  ) {
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
    const position = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start
    );
    return new DiagnosticError(
      flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      diagnostic.code,
      DiagnosticCategory[diagnostic.category].toLowerCase(),
      diagnostic.file.fileName,
      position.line + 1,
      position.character + 1
    );
  }
}
