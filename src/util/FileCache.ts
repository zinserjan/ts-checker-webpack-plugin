import { SourceFile } from "typescript";
import { getDependencies, hasGlobalImpact } from "./dependencies";

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
   * Dependencies of this file
   */
  dependencies: Array<string>;
  /**
   * Determines if this file was built by webpack
   */
  built: boolean;
  /**
   * Determines if this file has global impacts
   */
  globalImpact: boolean;
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
  dependencies: [],
  built: false,
  globalImpact: false,
  linted: false,
});

export default class FileCache {
  private files: Map<string, FileState>;
  private added: Map<string, string>;

  constructor() {
    this.files = new Map();
    this.added = new Map();
  }

  exist(file: string) {
    return this.files.has(file);
  }

  add(file: string, source: SourceFile) {
    this.added.set(file, file);
    this.update(file, {
      source,
      dependencies: [], // dependencies will be set later, see updateDependencies
    });

    const state = this.get(file) as FileState;

    if (state.typeDefinition) {
      state.globalImpact = hasGlobalImpact(source);
    }
  }

  get(file: string) {
    return this.files.get(file);
  }

  built(file: string) {
    this.update(file, {
      source: null,
      dependencies: [],
      built: true,
      globalImpact: false,
      linted: false,
    });
  }

  linted(file: string) {
    this.update(file, {
      linted: true,
    });
  }

  invalidate(file: string) {
    this.update(file, {
      source: null,
      dependencies: [],
      globalImpact: false,
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

  isNodeModule(file: string) {
    if (this.exist(file)) {
      const fileState = this.files.get(file) as FileState;
      return fileState.nodeModule;
    }
    return false;
  }

  hasFileGlobalImpacts(file: string) {
    if (this.exist(file)) {
      const fileState = this.files.get(file) as FileState;
      return fileState.globalImpact;
    }
    return false;
  }

  isFileLintable(file: string) {
    if (this.exist(file)) {
      const fileState = this.files.get(file) as FileState;
      return !fileState.linted && !fileState.typeDefinition && !fileState.nodeModule;
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
    return this.getFiles()
      .filter(fileState => fileState.typeDefinition || !fileState.built)
      .map(fileState => fileState.file);
  }

  getInvalidatedFiles() {
    return this.getFiles().filter(fileState => fileState.source == null).map(fileState => fileState.file);
  }

  getAddedFiles() {
    return Array.from(this.added.values());
  }

  updateDependencies(sourceFiles: Array<SourceFile>) {
    sourceFiles.forEach((source: SourceFile) => {
      this.update(source.fileName, {
        source,
        dependencies: getDependencies(source),
      });
    });
  }

  getAffectedFiles(modifiedFiles: Array<string>) {
    // all dependencies of a file
    const dependencyTree = new Map<string, Array<string>>();
    // all files that depent on a file
    const reverseDependencyTree = new Map<string, Array<string>>();
    // affected modules map
    const affectedModules = new Set<string>();

    const fileStates = this.getFiles();

    // build dependency & reverse dependency tree
    fileStates.forEach((fileState: FileState) => {
      dependencyTree.set(fileState.file, fileState.dependencies);
      fileState.dependencies.forEach((fileName: string) => {
        if (!reverseDependencyTree.has(fileName)) {
          reverseDependencyTree.set(fileName, []);
        }
        (reverseDependencyTree.get(fileName) as Array<string>).push(fileState.file);
      });
    });

    // collect affected files
    const affectedCollector = (fileName: string) => {
      if (affectedModules.has(fileName)) {
        // already collected, skip
        return;
      }

      affectedModules.add(fileName);
      // loop through all parents and mark them
      if (reverseDependencyTree.has(fileName)) {
        (reverseDependencyTree.get(fileName) as Array<string>).forEach(affectedCollector);
      }
    };
    modifiedFiles.forEach(affectedCollector);

    return affectedModules;
  }

  cleanup() {
    this.added.clear();
    this.getInvalidatedFiles().forEach(file => {
      this.remove(file);
      this.removeTypeDefinitionOfFile(file);
    });
  }

  private getFiles() {
    return Array.from(this.files.values());
  }

  private update(file: string, options: Partial<FileState>) {
    const fileState = this.exist(file) ? this.files.get(file) as FileState : createFile(file);
    this.files.set(file, Object.assign(fileState, options));
  }
}
