import { fork, ForkOptions, ChildProcess } from "child_process";

export const getProcess = () => process;

export const forkProcess: (modulePath: string, args: string[], options?: ForkOptions) => ChildProcess = (
  modulePath: string,
  args: string[],
  options?: ForkOptions
) => {
  return fork(modulePath, args, options);
};
