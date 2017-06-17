// Webpack compatible module definition for images resolved by file-loader

declare module "*.svg" {
  const content: string;
  export = content;
}
