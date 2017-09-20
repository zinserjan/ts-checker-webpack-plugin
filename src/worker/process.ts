import { fork, ForkOptions } from "child_process";

export const getProcess = () => process;

export const forkProcess = (modulePath: string, args: string[], options?: ForkOptions) => {
  return fork(modulePath, args, options);
};
