import * as path from "path";
import * as fs from "fs";
import webpack = require("webpack");
import MemoryFs = require("memory-fs");

const testCasesPath = path.join(__dirname, "testCases");
const tests = fs.readdirSync(testCasesPath).filter(dir => fs.statSync(path.join(testCasesPath, dir)).isDirectory());

const basePath = path.resolve(__dirname, "../");
const normalizeError = (error: string) =>
  error.replace(/\r\n?/g, "\n").replace(new RegExp(path.join(basePath), "g"), "Xdir");

/**
 * Dummy test
 */
describe("TsCheckerWebpackPlugin", () => {
  tests.forEach(testName => {
    const testPath = path.join(testCasesPath, testName);
    const webpackConfigPath = path.join(testPath, "webpack.config.ts");
    const webpackConfig = require(webpackConfigPath);

    it(testName, done => {
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

      c.run((err: Error, stats: webpack.Stats) => {
        expect(err).toBeFalsy();

        const { errors, warnings } = stats.toJson();

        if (stats.hasErrors()) {
          const normalizedErrors = errors.map(normalizeError);
          expect(normalizedErrors).toMatchSnapshot();
        }

        if (stats.hasWarnings()) {
          const normalizedWarnings = warnings.map(normalizeError);
          expect(normalizedWarnings).toMatchSnapshot();
        }

        done();
      });
    });
  });
});
