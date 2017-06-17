

declare class PCancelable<T> extends Promise<T> {
  constructor(executor: (onCancel: Function, onResolve: Function, onReject: Function) => void);

  cancel(): void;

  static CancelError: any;
}

declare module "p-cancelable" {
  export = PCancelable;
}
