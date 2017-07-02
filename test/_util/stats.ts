import { Stats } from "webpack";
import * as chalk from "chalk";
import normalizePath = require("normalize-path");

const normalizeError = (error: string) =>
  chalk
    .stripColor(error)
    // replace all line endings
    .replace(/\r\n?/g, "\n")
    // replace typescript messages, show only line:char + error
    .replace(/(\(\d+,\d+\):\s\w*\sTS\d*)([\w\W]*)/, "$1")
    // replace file path with xfile
    .replace(/([^('|"|\s|\w|\d)]|\w:)\.?((?:[^(\/\')]*\/)+)[^('||"\s)]*/gm, "xfile")
    .replace(/\.\.\.\./gm, "xfile");

export function normalizeStats(stats: Stats) {
  const statsJson = stats.toJson();

  const errors = statsJson.errors.map(normalizeError);
  const warnings = statsJson.warnings.map(normalizeError);

  return {
    errors,
    warnings,
  };
}
