#!/usr/bin/env bun
import { Command } from "commander";
import { globalFlags } from "./lib/config.js";
import { authCommand } from "./commands/auth.js";
import { projectsResource } from "./resources/projects.js";
import { clientsResource } from "./resources/clients.js";
import { tasksResource } from "./resources/tasks.js";
import { timeEntriesResource } from "./resources/time-entries.js";
import { reportsResource } from "./resources/reports.js";

const program = new Command();

program
  .name("rize-cli")
  .description("CLI for the Rize.io time tracker API")
  .version("0.1.0")
  .option("--json", "Output as JSON", false)
  .option("--format <fmt>", "Output format: text, json, csv, yaml", "text")
  .option("--verbose", "Enable debug logging", false)
  .option("--no-color", "Disable colored output")
  .option("--no-header", "Omit table/csv headers (for piping)")
  .hook("preAction", (_thisCmd, actionCmd) => {
    const root = actionCmd.optsWithGlobals();
    globalFlags.json = root.json ?? false;
    globalFlags.format = root.format ?? "text";
    globalFlags.verbose = root.verbose ?? false;
    globalFlags.noColor = root.color === false;
    globalFlags.noHeader = root.header === false;
  });

program.addCommand(authCommand);
program.addCommand(projectsResource);
program.addCommand(clientsResource);
program.addCommand(tasksResource);
program.addCommand(timeEntriesResource);
program.addCommand(reportsResource);

program.parse();
