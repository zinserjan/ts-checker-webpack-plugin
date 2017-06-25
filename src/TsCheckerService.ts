import IncrementalChecker from "./util/IncrementalChecker";
import { transformToWebpackBuildResult, serializeWebpackBuildResult } from "./util/resultSerializer";

process.on("SIGINT", function() {
  process.exit(130);
});

const tsconfigPath = process.env.TSCONFIG;
const tslintPath = process.env.TSLINT;

const incrementalChecker = new IncrementalChecker(tsconfigPath, tslintPath);

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

      const webpackResult = transformToWebpackBuildResult(result);
      const serialized = serializeWebpackBuildResult(webpackResult);

      sendMessage({
        ...messageOk,
        ...serialized,
      });
      break;
    }
  }
});
