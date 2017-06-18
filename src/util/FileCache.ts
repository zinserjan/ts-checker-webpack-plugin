import { SourceFile } from "typescript";

const NODE_MODULE = /node_modules/;
const TYPE_DEFINITION = /.*\.d\.ts$/;

export interface FileState {
  /**
   * File path of file for reverse matching
   */
  readonly file: string;
  /**
   * Determines if this file is a node_module
   */
  readonly nodeModule: boolean;
  /**
   * Determines if this file is a type definition file
   */
  readonly typeDefinition: boolean;
  /**
   * Source for TS checker
   */
  source: SourceFile | null;
  /**
   * Determines if this file was built by webpack
   */
  built: boolean;
  /**
   * Determines if this file was already linted
   */
  linted: boolean;
}

const createFile = (file: string): FileState => ({
  file,
  nodeModule: NODE_MODULE.test(file),
  typeDefinition: TYPE_DEFINITION.test(file),
  source: null,
  built: false,
  linted: false,
});

export default class FileCache {
  private files: Map<string, FileState>;

  constructor() {
    this.files = new Map();
  }

  exist(file: string) {
    return this.files.has(file);
  }

  add(file: string, source: SourceFile) {
    this.update(file, {
      source,
    });
  }

  built(file: string) {
    this.update(file, {
      source: null,
      built: true,
      linted: false,
    });
  }

  invalidate(file: string) {
    this.update(file, {
      source: null,
      linted: false,
    });
  }

  remove(file: string) {
    this.files.delete(file);
  }

  removeTypeDefinitionOfFile(file: string) {
    const typeFile = `${file}.d.ts`;
    if (this.exist(typeFile)) {
      this.remove(typeFile);
    }
  }

  isFileTypeCheckable(file: string) {
    if (this.exist(file)) {
      const fileState = this.files.get(file) as FileState;
      return fileState.built && !fileState.nodeModule;
    }
    return false;
  }

  getSource(file: string) {
    const fileState = this.files.get(file);
    return fileState != null ? fileState.source : null;
  }

  getTypeCheckRelatedFiles() {
    // type definitions are always relevant for type checking
    // other files with types can be determined with the built flag
    return Array.from(this.files.values())
      .filter(fileState => fileState.typeDefinition || !fileState.built)
      .map(fileState => fileState.file);
  }

  private update(file: string, options: Partial<FileState>) {
    const fileState = this.exist(file) ? this.files.get(file) as FileState : createFile(file);
    this.files.set(file, Object.assign(fileState, options));
  }
}
