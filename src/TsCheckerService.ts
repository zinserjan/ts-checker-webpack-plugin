import IncrementalChecker from "./util/IncrementalChecker";

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

      const lints = result.lints.map(lint => lint.toJSON());
      const diagnostics = result.diagnostics.map(diagnostic => diagnostic.toJSON());

      sendMessage({
        ...messageOk,
        ...result,
        lints,
        diagnostics,
      });
      break;
    }
  }
});
