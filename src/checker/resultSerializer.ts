import { RuleFailure } from "tslint";
import diagnosticFormatter from "ts-diagnostic-formatter";
import lintFormatter from "ts-tslint-formatter";
import { Diagnostic, DiagnosticCategory } from "typescript";
import { TsCheckerResult } from "./IncrementalChecker";

export type WebpackBuildResult = {
  checkTime: number;
  lintTime: number;
  errors: Array<Error>;
  warnings: Array<Error>;
};

export const serializeError = require("serialize-error");
export const deserializeError = (err: object) => Object.assign(new Error(), { stack: undefined }, err);

/**
 * Transforms TsCheckerResult into WebpackBuildResult
 */
export const transformToWebpackBuildResult = (
  result: TsCheckerResult,
  contextPath: string,
  diagnosticFormat: string,
  tslintEmitErrors: boolean
): WebpackBuildResult => {
  const diagnosticErrors = result.diagnostics.filter(
    (diagnostic: Diagnostic) => DiagnosticCategory[diagnostic.category].toLowerCase() === "error"
  );
  const diagnosticWarnings = result.diagnostics.filter(
    (diagnostic: Diagnostic) => DiagnosticCategory[diagnostic.category].toLowerCase() !== "error"
  );

  const lintErrors = result.lints.filter(
    (failure: RuleFailure) => failure.getRuleSeverity() === "error" || tslintEmitErrors
  );
  const lintWarnings = tslintEmitErrors
    ? []
    : result.lints.filter((failure: RuleFailure) => failure.getRuleSeverity() !== "error");

  const errors = [
    ...diagnosticFormatter(diagnosticErrors, diagnosticFormat, contextPath),
    ...lintFormatter(lintErrors, "stylish", contextPath),
  ];
  const warnings = [
    ...diagnosticFormatter(diagnosticWarnings, diagnosticFormat, contextPath),
    ...lintFormatter(lintWarnings, "stylish", contextPath),
  ];

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
    errors: result.errors.map(deserializeError),
    warnings: result.warnings.map(deserializeError),
  };
};
