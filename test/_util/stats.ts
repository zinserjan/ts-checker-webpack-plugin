import * as path from "path";
import { Stats } from "webpack";

const basePath = path.resolve(__dirname, "../..");
const normalizeError = (error: string) =>
  error.replace(/\r\n?/g, "\n").replace(new RegExp(basePath, "g"), "xfile").replace(/xfile[^('|\s)]*/g, "xfile");

export function normalizeStats(stats: Stats) {
  const statsJson = stats.toJson();

  const errors = statsJson.errors.map(normalizeError);
  const warnings = statsJson.warnings.map(normalizeError);

  return {
    errors,
    warnings,
  };
}
