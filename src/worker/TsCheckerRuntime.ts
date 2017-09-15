import * as path from "path";
import IncrementalChecker from "../checker/IncrementalChecker";
import { transformToWebpackBuildResult, serializeWebpackBuildResult } from "../checker/resultSerializer";

export interface TsCheckerRuntimeConfig {
  tsconfigPath: string;
  diagnosticFormatter: string;
  tslintPath?: string;
  tslintEmitErrors: boolean;
  timings: boolean;
  ignoreDiagnostics: Array<number>;
  ignoreLints: Array<string>;
}

process.on("SIGINT", function() {
  process.exit(130);
});

const config: TsCheckerRuntimeConfig = JSON.parse(process.env.TS_CHECKER_CONFIG);
const contextPath = path.dirname(config.tsconfigPath);

const incrementalChecker = new IncrementalChecker(config.timings, config.tsconfigPath, config.tslintPath);

const messageOk = {
  id: "ok",
};

const sendMessage = (...args: Array<any>) => {
  (process as any).send(...args);
};

process.on("message", function(message: any) {
  switch (message.id) {
    case "invalidateFiles": {
      incrementalChecker.invalidateFiles(message.changes, message.removals);
      sendMessage(messageOk);
      break;
    }
    case "typeCheckRelatedFiles": {
      const files = incrementalChecker.getTypeCheckRelatedFiles();
      sendMessage({
        ...messageOk,
        files,
      });
      break;
    }
    case "typeCheck": {
      incrementalChecker.updateBuiltFiles(message.files);
      const result = incrementalChecker.run();

      if (config.ignoreDiagnostics.length) {
        result.diagnostics = result.diagnostics.filter(
          diagnostic => config.ignoreDiagnostics.indexOf(diagnostic.code) === -1
        );
      }

      if (config.ignoreLints.length) {
        result.lints = result.lints.filter(ruleFailure => config.ignoreLints.indexOf(ruleFailure.getRuleName()) === -1);
      }

      const webpackResult = transformToWebpackBuildResult(
        result,
        contextPath,
        config.diagnosticFormatter,
        config.tslintEmitErrors
      );
      const serialized = serializeWebpackBuildResult(webpackResult);

      sendMessage({
        ...messageOk,
        ...serialized,
      });
      break;
    }
  }
});
