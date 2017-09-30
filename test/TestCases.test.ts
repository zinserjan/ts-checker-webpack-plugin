import * as path from "path";
import * as fs from "fs-extra";
import webpack = require("webpack");
import MemoryFs = require("memory-fs");
import pDefer = require("p-defer");
import { createExpectBuildError, createExpectStats, satisfiesVersionRequirements } from "./_util/testHelper";
import * as processMock from "./_util/processMock";

const testCasesPath = path.join(__dirname, "testCases");
const tests = fs.readdirSync(testCasesPath).filter(dir => fs.statSync(path.join(testCasesPath, dir)).isDirectory());

const tmpPath = path.resolve(__dirname, "../.tmp/testCases");

jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;

describe("TestCases", () => {
  beforeAll(() => {
    return fs.emptyDir(tmpPath);
  });

  beforeEach(() => processMock.register());
  afterEach(() => processMock.unregister());

  tests.forEach(testName => {
    const testPath = path.join(testCasesPath, testName);
    const tmpTestPath = path.join(tmpPath, testName);
    const webpackConfigPath = path.join(tmpTestPath, "webpack.config.ts");
    const skipTest = !satisfiesVersionRequirements(path.join(testPath, "versions.json"));
    const expectStats = createExpectStats(path.join(testPath, "expectation.ts"));
    const expectBuildError = createExpectBuildError(path.join(testPath, "expectation.ts"));

    (skipTest ? it.skip : it)(testName, async () => {
      await fs.copy(testPath, tmpTestPath);

      const webpackConfig = require(webpackConfigPath);
      const c = webpack(webpackConfig);
      const compilers = (c as any).compilers ? (c as any).compilers : [c];

      compilers.forEach((compiler: any) => {
        const ifs = compiler.inputFileSystem;
        compiler.inputFileSystem = Object.create(ifs);
        compiler.outputFileSystem = new MemoryFs();
        compiler.inputFileSystem.readFile = function() {
          const args = Array.prototype.slice.call(arguments);
          const callback = args.pop();
          ifs.readFile.apply(
            ifs,
            args.concat([
              (err: any, result: any) => {
                if (err) return callback(err);
                callback(null, result.toString("utf-8").replace(/\r/g, ""));
              },
            ])
          );
        };
        compiler.apply(new webpack.optimize.OccurrenceOrderPlugin(false));
      });

      const deferred = pDefer();
      c.run((err: Error, stats: webpack.Stats) => {
        if (err) {
          expectBuildError(err, 0);
          return process.nextTick(deferred.resolve);
        }

        expectStats(stats, 0);

        process.nextTick(deferred.resolve);
      });
      return deferred.promise;
    });
  });
});
