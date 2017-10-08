import * as path from "path";
import * as fs from "fs";
import { SourceFile } from "typescript";
import normalizePath = require("normalize-path");
import { hasGlobalImpact } from "../../../src/util/dependencies";

const getFiles = folder =>
  fs
    .readdirSync(folder)
    .map(file => path.join(folder, file))
    .filter(file => fs.statSync(file).isFile())
    .map(normalizePath);

const getSourceFiles = (files: Array<string>, sourceFiles: Array<SourceFile>) =>
  sourceFiles.filter(file => files.indexOf(file.fileName) !== -1);

const testGlobalImpact = (result: boolean, testPath: string, sourceFiles: Array<SourceFile>) => {
  const testFiles = getFiles(testPath);
  const testSourceFiles = getSourceFiles(testFiles, sourceFiles);

  expect(testSourceFiles).toHaveLength(testFiles.length);

  testSourceFiles.forEach(file => {
    expect(file.fileName + ":" + hasGlobalImpact(file)).toBe(file.fileName + ":" + result);
  });
};

export function expectSourceFiles(sourceFiles: Array<SourceFile>) {
  testGlobalImpact(true, path.join(__dirname, "./src/with-global-impact"), sourceFiles);
  testGlobalImpact(false, path.join(__dirname, "./src/without-global-impact"), sourceFiles);
}
