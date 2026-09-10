import { YggdrasilServer } from "./server";

export const defineConfig = (config: YggdrasilServer.Config) => config;

export default YggdrasilServer;

export * from "./config";
export * from "./libs";
export * from "./server";
