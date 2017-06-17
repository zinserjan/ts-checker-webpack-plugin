import * as path from "path";
import * as fs from "fs-extra";
import webpack = require("webpack");
import MemoryFs = require("memory-fs");
import { normalizeStats } from "./_util/stats";

const testCasesPath = path.join(__dirname, "watchCases");
const tests = fs.readdirSync(testCasesPath).filter(dir => fs.statSync(path.join(testCasesPath, dir)).isDirectory());

const tmpPath = path.resolve(__dirname, "../.tmp");

const removeFiles = async (dir: string) => {
  const files = await fs.readdir(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const isDirectory = (await fs.stat(filePath)).isDirectory();
    if (isDirectory) {
      await removeFiles(filePath);
    } else {
      const content = (await fs.readFile(filePath)).toString("utf-8");
      if (/DELETE/.test(content)) {
        await fs.remove(filePath);
      }
    }
  }
};

describe("WatchCases", () => {
  beforeAll(() => {
    return fs.emptyDir(tmpPath);
  });

  tests.forEach(testName => {
    const testPath = path.join(testCasesPath, testName);
    const tmpTestPath = path.join(tmpPath, "watchCases", testName);
    const tmpStepsPath = path.join(tmpTestPath, "steps");
    const srcTarget = path.join(tmpTestPath, "src");

    it(testName, async () => {
      await fs.copy(testPath, tmpTestPath);

      const copyDiff = async (stepIndex: string) => {
        const srcStep = path.join(tmpStepsPath, stepIndex);
        await fs.copy(srcStep, srcTarget);
        await removeFiles(srcTarget);
      };

      const steps = (await fs.readdir(tmpStepsPath)).sort();
      const firstStep = steps.shift() as string;
      await copyDiff(firstStep);

      const webpackConfigPath = path.join(tmpTestPath, "webpack.config.ts");
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

      let resolve: Function;
      let reject: Function;
      const promise = new Promise((rs, rj) => {
        resolve = rs;
        reject = rj;
      });

      const watching = c.watch(
        {
          aggregateTimeout: 1000,
          poll: 400,
        },
        (err, stats) => {
          if (err) {
            return reject(err);
          }

          const normalizedStats = normalizeStats(stats);
          expect(normalizedStats).toMatchSnapshot();

          if (steps.length > 0) {
            const nextStep = steps.shift() as string;
            copyDiff(nextStep);
          } else {
            watching.close(() => null);
            process.nextTick(resolve);
          }
        }
      );
      return promise;
    });
  });
});
