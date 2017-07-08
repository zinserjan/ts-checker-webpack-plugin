import now = require("performance-now");

export default class Logger {
  private enabled: boolean = false;
  private times: Map<string, number> = new Map<string, number>();

  enable() {
    this.enabled = true;
  }

  time(label: string) {
    if (this.enabled) {
      this.times.set(label, now());
    }
  }

  timeEnd(label: string) {
    if (this.enabled) {
      const timeEnd = now();
      const timeStart = <number>this.times.get(label);
      this.times.delete(label);
      const diff = (timeEnd - timeStart).toFixed(3);

      this.log("%s: %dms", label, diff);
    }
  }

  log(message: string, ...args: Array<any>) {
    if (this.enabled) {
      console.log(message, ...args);
    }
  }
}
