import { Node, SyntaxKind, SourceFile } from "typescript";

const hasNodeGlobalImpact = (node: Node): boolean => {
  if (node.kind === SyntaxKind.DeclareKeyword) {
    return true;
  }
  const nodes: Array<Node> = [];
  node.forEachChild((node: Node) => {
    nodes.push(node);
  });
  return nodes.some(hasNodeGlobalImpact);
};

export const getNodes = (sourceFile: SourceFile): Array<Node> => {
  const nodes: Array<Node> = [];
  sourceFile.forEachChild((node: Node) => {
    nodes.push(node);
  });
  return nodes;
};

export const hasGlobalImpact = (sourceFile: SourceFile): boolean => {
  const nodes = getNodes(sourceFile);
  return nodes.some(hasNodeGlobalImpact);
};

export const getDependencies = (sourceFile: SourceFile) => {
  const resolvedModules = (sourceFile as any).resolvedModules;
  if (resolvedModules) {
    return Array.from(resolvedModules.values())
      .filter((resolved: any) => Boolean(resolved))
      .map((resolved: any) => resolved.resolvedFileName);
  }
  return [];
};
