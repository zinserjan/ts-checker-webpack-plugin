import { Node, SyntaxKind, SourceFile } from "typescript";

const hasNodeGlobalImpact = (node: Node): boolean => {
  if (node.kind === SyntaxKind.DeclareKeyword) {
    return true;
  }
  return getNodes(node).some(hasNodeGlobalImpact);
};

const hasModules = (sourceFile: SourceFile): boolean => {
  return /import |export |module.exports|exports/.test(sourceFile.text);
};

const getNodes = (item: { forEachChild: (cbNode: (node: Node) => void) => void }): Array<Node> => {
  const nodes: Array<Node> = [];
  item.forEachChild((node: Node) => {
    nodes.push(node);
  });
  return nodes;
};

export const hasGlobalImpact = (sourceFile: SourceFile): boolean => {
  const nodes = getNodes(sourceFile);
  return nodes.some(hasNodeGlobalImpact) || !hasModules(sourceFile);
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
