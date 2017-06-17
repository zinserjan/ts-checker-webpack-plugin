import { SourceFile } from "typescript";

export interface FileState {
  source: SourceFile | null;
  linted: boolean;
  checked: boolean;
}

export default class FileCache {
  private files: Map<string, FileState>;

  constructor() {
    this.files = new Map();
  }

  exist(file: string) {
    return this.files.has(file);
  }

  add(file: string, source: SourceFile) {
    this.files.set(file, {
      source: source,
      linted: false,
      checked: false,
    });
  }

  invalidate(file: string) {
    this.files.set(file, {
      source: null,
      linted: false,
      checked: false,
    });
  }

  remove(file: string) {
    this.files.delete(file);
  }

  getSource(file: string) {
    const fileState = this.files.get(file);
    return fileState != null ? fileState.source : null;
  }

  getFiles() {
    return Array.from(this.files.keys());
  }

  allChecked() {
    this.files.forEach(file => {
      file.checked = true;
    });
  }
}
