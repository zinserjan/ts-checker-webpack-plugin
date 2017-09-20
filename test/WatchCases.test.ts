import * as path from "path";
import * as fs from "fs-extra";
import webpack = require("webpack");
import MemoryFs = require("memory-fs");
import pDefer = require("p-defer");
import { createAssertExpectation, satisfiesVersionRequirements } from "./_util/testHelper";
import * as processMock from "./_util/processMock";

const testCasesPath = path.join(__dirname, "watchCases");
const tests = fs.readdirSync(testCasesPath).filter(dir => fs.statSync(path.join(testCasesPath, dir)).isDirectory());

const tmpPath = path.resolve(__dirname, "../.tmp/watchCases");

let time = Date.now() / 1000;
const copySmart = (srcPath: string, targetPath: string) => {
  time += 10;
  const files = fs.readdirSync(srcPath);

  for (const file of files) {
    const srcFilePath = path.join(srcPath, file);
    const targetFilePath = path.join(targetPath, file);
    const isDirectory = fs.statSync(srcFilePath).isDirectory();
    if (isDirectory) {
      copySmart(srcFilePath, targetFilePath);
    } else {
      const content = fs.readFileSync(srcFilePath).toString("utf-8");
      if (/DELETE/.test(content)) {
        fs.removeSync(targetFilePath);
      } else {
        const exists = fs.existsSync(targetFilePath);
        if (exists) {
          fs.writeFileSync(targetFilePath, content);
        } else {
          fs.copySync(srcFilePath, targetFilePath);
        }
        // make sure that the last modified time was touched
        fs.utimesSync(targetFilePath, time, time);
      }
    }
  }
};

jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;

describe("WatchCases", () => {
  beforeAll(() => {
    return fs.emptyDir(tmpPath);
  });

  beforeEach(() => processMock.register());
  afterEach(() => processMock.unregister());

  tests.forEach(testName => {
    const testPath = path.join(testCasesPath, testName);
    const tmpTestPath = path.join(tmpPath, testName);
    const tmpStepsPath = path.join(tmpTestPath, "steps");
    const srcTarget = path.join(tmpTestPath, "src");
    const webpackConfigPath = path.join(tmpTestPath, "webpack.config.ts");
    const skipTest = !satisfiesVersionRequirements(path.join(testCasesPath, "versions.json"));
    const assertExpectation = createAssertExpectation(path.join(testPath, "expectation.ts"));

    (skipTest ? it.skip : it)(testName, async () => {
      await fs.copy(testPath, tmpTestPath);

      const copyDiff = async (stepIndex: string) => {
        const srcStep = path.join(tmpStepsPath, stepIndex);
        await copySmart(srcStep, srcTarget);
      };

      const steps = (await fs.readdir(tmpStepsPath)).sort();
      const stepCount = steps.length;
      const firstStep = steps.shift() as string;
      await copyDiff(firstStep);

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
      const watching = c.watch(
        {
          aggregateTimeout: 1000,
          poll: 400,
        },
        (err, stats) => {
          if (err) {
            return deferred.reject(err);
          }

          assertExpectation(stats, stepCount - (steps.length + 1));

          if (steps.length > 0) {
            const nextStep = steps.shift() as string;
            copyDiff(nextStep);
          } else {
            watching.close(() => null);
            process.nextTick(deferred.resolve);
          }
        }
      );
      return deferred.promise;
    });
  });
});
