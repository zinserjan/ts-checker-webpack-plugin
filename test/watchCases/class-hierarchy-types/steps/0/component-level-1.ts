import { Component } from "./interfaces";

export class ComponentLevel1 implements Component {
  doStuff(x: string) {
    return "string";
  }
}
