import { TsCheckerResult } from "./IncrementalChecker";
import { BaseError, DiagnosticError, LintError } from "./Error";
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
export const transformToWebpackBuildResult = (result: TsCheckerResult): WebpackBuildResult => {
  const diagnostics = result.diagnostics.map(DiagnosticError.createFromDiagnostic);
  const lints = result.lints.map(LintError.createFromLint);

  const allErrors: Array<BaseError> = ([] as Array<BaseError>).concat(lints, diagnostics);
  const errors: Array<Error> = allErrors.filter(e => !e.isWarningSeverity());
  const warnings: Array<Error> = allErrors.filter(e => e.isWarningSeverity());

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
