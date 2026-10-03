import { env, exit } from "node:process";

import cac from "cac";
import { cosmiconfig } from "cosmiconfig";
import { paramCase, pick } from "cosmokit";

import { name, version } from "../package.json";
import { Lisardggy } from "./server";
import { deepMerge, loadConfigFromEnv, loadEnvFiles, type DeepPartial } from "./utils";

export interface CommandLineOptions extends Lisardggy.Config {
  config?: string;
  env?: string | string[];
  managementApi?: Lisardggy.Config["managementAPI"];
  [k: string]: unknown;
}

const configFileList = [
  `${name}.json`,
  `${name}.yaml`,
  `${name}.yml`,
  `${name}.config.js`,
  `${name}.config.ts`,
  `${name}.config.mjs`,
  `${name}.config.cjs`,
  `${name}.config.mts`,
  `${name}.config.cts`,
];

const cli = cac(name).help().version(version);

cli
  .option("-c, --config [filepath]", "Specify a configurstion file")
  .option("-e, --env [filepath]", "Load environment variables from file(s)");

Object.entries(Lisardggy.Config.dict!).forEach(([k, v]) =>
  cli.option(
    `--${paramCase(k)}${["number", "string"].includes(v.type) ? ` [${k}]` : ""}`,
    (v.meta.description as string | undefined) ?? "",
  ),
);

cli.command("").action(() => {
  cli.outputHelp();
});

cli.command("show-configs", "Show config schema and exit").action(() => {
  console.log(Lisardggy.Config.toString());
  exit(0);
});

cli.command("start", "Start Lisardggy server").action(async (options: CommandLineOptions) => {
  loadEnvFiles(options.env);

  if (options["managementApi"]) {
    options.managementAPI = options["managementApi"];
    Reflect.deleteProperty(options, "managementApi");
  }
  if (env["NODE_ENV"] === "debug") console.debug("config from CLI:", options);
  const configExplorer = cosmiconfig(name, { searchPlaces: configFileList });
  const { config: fileConfig = {}, filepath } = ((await (options.config
    ? configExplorer.load(options.config)
    : configExplorer.search())) ?? {}) as {
    config?: DeepPartial<Lisardggy.Config>;
    filepath?: string;
  };
  if (filepath) {
    console.log(`Using configuration file ${filepath}`);
    if (env["NODE_ENV"] === "development") console.debug("config from file:", fileConfig);
  }

  const envConfig = loadConfigFromEnv("LISARDGGY_CONFIG", Lisardggy.Config) ?? {};
  const cliConfig = pick(options, Object.keys(Lisardggy.Config.dict!));
  const mergedConfig = deepMerge(cliConfig, envConfig, fileConfig);
  if (env["NODE_ENV"] === "development") console.debug("merged config:", mergedConfig);

  console.log(`Starting Lisardggy v${version}...`);
  const server = new Lisardggy(mergedConfig);
  await server.start();
  process.on("SIGINT", () => void server.stop());
  process.on("SIGTERM", () => void server.stop());
});

cli.parse();
