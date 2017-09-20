// jest.mock calls are hoisted automatically to the top, so we can do this manually to show this behaviour
jest.mock("../../src/worker/process");

import { ForkOptions } from "child_process";
import { EventEmitter } from "events";
let processUtil = null;

const jest = jest;

export const register = () => {
  if (process.env.MOCK_PROCESS_FOR_COVERAGE !== "true") {
    // skip mocking & restore original when mocking is not requested
    jest.unmock("../../src/worker/process");
    return;
  }

  // need to reset modules to reload TsCheckerRuntime & other modules that depend on it to force reload of process
  jest.resetModules();
  processUtil = require("../../src/worker/process");

  const eventEmitter = new EventEmitter();
  let env = {};
  const childProcessMock = {
    on(...args) {
      return eventEmitter.on(...args);
    },
    once(...args) {
      return eventEmitter.once(...args);
    },
    send(...args) {
      return eventEmitter.emit("message", ...args);
    },
    removeAllListeners() {
      return eventEmitter.removeAllListeners();
    },
    kill: () => undefined,
    get env() {
      return env;
    },
  };

  processUtil.getProcess.mockImplementation(() => childProcessMock);

  processUtil.forkProcess.mockImplementation((modulePath: string, args: string[], options: ForkOptions) => {
    env = options.env;
    if (args.length > 0) {
      require(args[0]);
    } else {
      require(modulePath);
    }

    return childProcessMock;
  });
};

export const unregister = () => {
  if (processUtil != null) {
    processUtil.getProcess.mockRestore();
    processUtil.forkProcess.mockRestore();
  }
};
