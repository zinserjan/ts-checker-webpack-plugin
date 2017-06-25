import diagnosticFormatter from "ts-diagnostic-formatter";
import { Diagnostic, DiagnosticCategory } from "typescript";
import { TsCheckerResult } from "./IncrementalChecker";
import { LintError } from "./Error";
const serializeError = require("serialize-error");

export type WebpackBuildResult = {
  checkTime: number;
  lintTime: number;
  errors: Array<Error>;
  warnings: Array<Error>;
};

/**
 * Transforms TsCheckerResult into WebpackBuildResult
 */
export const transformToWebpackBuildResult = (
  result: TsCheckerResult,
  contextPath: string,
  diagnosticFormat: string
): WebpackBuildResult => {
  const diagnosticErrors = result.diagnostics.filter(
    (diagnostic: Diagnostic) => DiagnosticCategory[diagnostic.category].toLowerCase() === "error"
  );
  const diagnosticWarnings = result.diagnostics.filter(
    (diagnostic: Diagnostic) => DiagnosticCategory[diagnostic.category].toLowerCase() !== "error"
  );

  const lints = result.lints.map(LintError.createFromLint);

  const lintErrors = lints.filter(e => !e.isWarningSeverity());
  const lintWarnings = lints.filter(e => e.isWarningSeverity());

  const errors = [...diagnosticFormatter(diagnosticErrors, diagnosticFormat, contextPath), ...lintErrors];
  const warnings = [...diagnosticFormatter(diagnosticWarnings, diagnosticFormat, contextPath), ...lintWarnings];

  return {
    checkTime: result.checkTime,
    lintTime: result.lintTime,
    errors,
    warnings,
  };
};

/**
 * Serializes WebpackBuildResult into a plain object which can be stringified by JSON.stringify()
 */
export const serializeWebpackBuildResult = (result: WebpackBuildResult): any => {
  return {
    checkTime: result.checkTime,
    lintTime: result.lintTime,
    errors: result.errors.map(serializeError),
    warnings: result.warnings.map(serializeError),
  };
};

/**
 * Deserializes a plain object into WebpackBuildResult
 */
export const deserializeWebpackBuildResult = (result: any): WebpackBuildResult => {
  return {
    checkTime: result.checkTime,
    lintTime: result.lintTime,
    errors: result.errors.map((err: any) => Object.assign(new Error(), { stack: undefined }, err)),
    warnings: result.warnings.map((err: any) => Object.assign(new Error(), { stack: undefined }, err)),
  };
};
