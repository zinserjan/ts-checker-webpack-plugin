import * as path from "path";
import * as fs from "fs-extra";
import * as ts from "typescript";

import { satisfiesVersionRequirements } from "./_util/testHelper";

const testCasesPath = path.join(__dirname, "typescriptFileCases");
const tests = fs.readdirSync(testCasesPath).filter(dir => fs.statSync(path.join(testCasesPath, dir)).isDirectory());

jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;

describe("TypescriptFileCases", () => {
  tests.forEach(testName => {
    const testPath = path.join(testCasesPath, testName);
    const skipTest = !satisfiesVersionRequirements(path.join(testPath, "versions.json"));
    const testHelper = require(path.join(testPath, "test.ts"));
    const tsconfigPath = path.join(testPath, "tsconfig.json");

    (skipTest ? it.skip : it)(testName, () => {
      const programConfig = ts.parseJsonConfigFileContent(
        ts.readConfigFile(tsconfigPath, ts.sys.readFile).config,
        ts.sys,
        path.dirname(tsconfigPath)
      );
      const programm = ts.createProgram(programConfig.fileNames, programConfig.options);
      const sourceFiles = programm.getSourceFiles();

      testHelper.expectSourceFiles(sourceFiles);
    });
  });
});
