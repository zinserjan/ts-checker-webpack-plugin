import { Stats } from "webpack";
import * as chalk from "chalk";
import normalizePath = require("normalize-path");

const normalizeError = (error: string) =>
  chalk
    .stripColor(error)
    .replace(/\r\n?/g, "\n")
    .replace(/[^('|"|\s|\w\d)]\.?((?:[^(\/\')]*\/)+)[^('||"\s)]*/gm, "xfile");

export function normalizeStats(stats: Stats) {
  const statsJson = stats.toJson();

  const errors = statsJson.errors.map(normalizeError);
  const warnings = statsJson.warnings.map(normalizeError);

  return {
    errors,
    warnings,
  };
}
