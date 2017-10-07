import { SourceFile } from "typescript";
import normalizePath = require("normalize-path");
import * as path from "path";
import { getDependencies } from "../../../src/util/dependencies";

export function expectSourceFiles(sourceFiles: Array<SourceFile>) {
  const entry = path.join(__dirname, "./src/entry.ts");

  const dependencies = [
    path.join(__dirname, "./src/modules/interface.ts"),
    path.join(__dirname, "./src/modules/module1.ts"),
    path.join(__dirname, "./src/modules/module2.ts"),
  ].map(normalizePath);

  const requireDependencies = [path.join(__dirname, "./src/modules/module3.ts")].map(normalizePath);

  const entrySource = sourceFiles.find(file => file.fileName === entry);

  const entryDependencies = getDependencies(entrySource);

  dependencies.forEach(dep => expect(entryDependencies).toContain(dep));

  // commonjs require calls are not detected
  requireDependencies.forEach(dep => expect(entryDependencies).not.toContain(dep));
}
