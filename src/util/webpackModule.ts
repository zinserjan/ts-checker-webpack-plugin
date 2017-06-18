export const stripLoader = (filePath: string) => {
  const lastIndex = filePath.lastIndexOf("!");

  if (lastIndex !== -1) {
    return filePath.substr(lastIndex + 1);
  }
  return filePath;
};
