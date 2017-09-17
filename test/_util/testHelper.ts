import * as fs from "fs";
import { satisfies } from "semver";
import webpack = require("webpack");
import { normalizeStats } from "./stats";

export function satisfiesVersionRequirements(path: string) {
  const exists = fs.existsSync(path);
  if (!exists) {
    return true;
  }
  const versionsRequirements: { [key: string]: string } = require(path);
  return Object.keys(versionsRequirements).every((library: string) => {
    const version = require(`${library}/package.json`).version;
    return satisfies(version, versionsRequirements[library]);
  });
}

export function createAssertExpectation(path): (stats: webpack.Stats, run: number) => void {
  const exists = fs.existsSync(path);
  let helper = (stats: webpack.Stats, run: number) => {
    const normalizedStats = normalizeStats(stats);
    expect(normalizedStats).toMatchSnapshot();
  };

  if (exists) {
    const module = require(path);
    helper = typeof module !== "function" && typeof module.default === "function" ? module.default : module;
  }

  return helper;
}
