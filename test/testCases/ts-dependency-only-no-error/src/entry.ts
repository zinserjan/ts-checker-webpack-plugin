import { Test } from "./type";

export default class TestImpl implements Test {
  doStuff(): void {
    throw new Error("Method not implemented.");
  }
}
