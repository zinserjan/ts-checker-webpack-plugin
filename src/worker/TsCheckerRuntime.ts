import * as path from "path";
import IncrementalChecker from "../checker/IncrementalChecker";
import { transformToWebpackBuildResult, serializeWebpackBuildResult } from "../checker/resultSerializer";

process.on("SIGINT", function() {
  process.exit(130);
});

const tsconfigPath = process.env.TSCONFIG;
const diagnosticFormatter = process.env.DIAGNOSTIC_FORMATTER;
const tslintPath = process.env.TSLINT;
const timings = process.env.TIMINGS === "true";
const contextPath = path.dirname(tsconfigPath);

const incrementalChecker = new IncrementalChecker(timings, tsconfigPath, tslintPath);

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

      const webpackResult = transformToWebpackBuildResult(result, contextPath, diagnosticFormatter);
      const serialized = serializeWebpackBuildResult(webpackResult);

      sendMessage({
        ...messageOk,
        ...serialized,
      });
      break;
    }
  }
});
