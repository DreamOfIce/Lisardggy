import cac from "cac";
import { cosmiconfig } from "cosmiconfig";
import { isNonNullable, isPlainObject, paramCase, pick } from "cosmokit";

import { name, version } from "../package.json";
import { YggdrasilServer } from "./server";

export interface CommandLineOptions extends YggdrasilServer.Config {
  config?: string;
  managementApi?: YggdrasilServer.Config["managementAPI"];
  [k: string]: unknown;
}

export const mergeConfig = <T>(...configs: T[]): T => {
  const result = configs.findLast(isNonNullable);
  if (isPlainObject(result))
    return Object.fromEntries(
      Object.keys(result!).map((k) => [
        k,
        mergeConfig(
          ...configs.map((c: T) =>
            isPlainObject(c) ? (c as Record<string, unknown>)[k] : undefined,
          ),
        ),
      ]),
    ) as T;
  else return result as T;
};

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

cli.option("-c, --config", "Specify a config file");

Object.entries(YggdrasilServer.Config.dict!).forEach(([k, v]) =>
  cli.option(
    `--${paramCase(k)}${["number", "string"].includes(v.type) ? ` [${k}]` : ""}`,
    (v.meta.description as string | undefined) ?? "",
  ),
);

cli.command("", "Start Yggdrasil server").action(async (options: CommandLineOptions) => {
  if (options["managementApi"]) {
    options.managementAPI = options["managementApi"];
    Reflect.deleteProperty(options, "managementApi");
  }
  console.debug("config from CLI:", options);
  const configExplorer = cosmiconfig(name, { searchPlaces: configFileList });
  const { config = {}, filepath } = ((await (options.config
    ? configExplorer.load(options.config)
    : configExplorer.search())) ?? {}) as {
    config?: Partial<YggdrasilServer.Config>;
    filepath?: string;
  };
  if (filepath) {
    console.log(`Using configuration file ${filepath}`);
    console.debug("config from file:", config);
  }

  const mergedConfig = mergeConfig(
    config,
    pick(options, Object.keys(YggdrasilServer.Config.dict!)),
  );
  console.debug("merged config:", mergedConfig);

  console.log(`Starting Yggdrasil server v${version}...`);
  const server = new YggdrasilServer(mergedConfig);
  await server.start();
});

cli.parse();
