import * as fs from "fs";
import { satisfies } from "semver";

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
