import { Command } from "commander";
import { graphql, unwrapConnection, row, csvList, intOpt, wantsJson } from "../lib/graphql.js";
import { output } from "../lib/output.js";
import { handleError, CliError } from "../lib/errors.js";

const TASK_FIELDS = `
  id name status color emoji dueDate lastUsedAt
  project { id name } assignee { id name } team { id name }
`;

interface ActionOpts {
  json?: boolean;
  format?: string;
  fields?: string;
  query?: string;
  status?: string;
  projectIds?: string;
  assignedToMe?: boolean;
  first?: string;
  after?: string;
}

export const tasksResource = new Command("tasks").description("List and inspect Rize tasks");

tasksResource
  .command("list")
  .description("List tasks")
  .option("--query <text>", "Search by name")
  .option("--status <statuses>", "Comma-separated statuses (default: in_progress,completed)")
  .option("--project-ids <ids>", "Comma-separated project IDs")
  .option("--assigned-to-me", "Only tasks assigned to the current user")
  .option("--first <n>", "Page size", "20")
  .option("--after <cursor>", "Forward pagination cursor")
  .option("--fields <cols>", "Comma-separated columns to display")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .addHelpText("after", "\nExamples:\n  rize-cli tasks list\n  rize-cli tasks list --assigned-to-me --json")
  .action(async (opts: ActionOpts) => {
    try {
      const statuses = opts.status?.split(",").map((s) => s.trim()).filter(Boolean);
      const data = await graphql<{
        tasks?: { nodes?: Record<string, unknown>[]; pageInfo?: unknown };
      }>(
        `query Tasks($query: String, $statuses: [String!], $projectIds: [ID!], $assignedToMe: Boolean, $first: Int, $after: String) {
          tasks(query: $query, statuses: $statuses, projectIds: $projectIds, assignedToMe: $assignedToMe, first: $first, after: $after) {
            nodes { ${TASK_FIELDS} }
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
          }
        }`,
        {
          query: opts.query,
          statuses,
          projectIds: csvList(opts.projectIds),
          assignedToMe: opts.assignedToMe || undefined,
          first: intOpt(opts.first) ?? 20,
          after: opts.after,
        },
      );
      const nodes = unwrapConnection(data.tasks);
      const fields = opts.fields?.split(",") ?? ["id", "name", "status", "project"];
      output(
        wantsJson(opts) ? { items: nodes, pageInfo: data.tasks?.pageInfo } : nodes.map((n) => row(n, fields)),
        { json: wantsJson(opts), format: opts.format, fields: opts.json ? undefined : fields },
      );
    } catch (err) {
      handleError(err, wantsJson(opts));
    }
  });

tasksResource
  .command("get")
  .description("Get a task by ID")
  .argument("<id>", "Task ID")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .addHelpText("after", "\nExample:\n  rize-cli tasks get 123")
  .action(async (id: string, opts: ActionOpts) => {
    try {
      const data = await graphql<{ task?: Record<string, unknown> | null }>(
        `query Task($id: ID!) { task(id: $id) { ${TASK_FIELDS} } }`,
        { id },
      );
      if (!data.task) throw new CliError(404, "Task not found");
      output(data.task, { json: wantsJson(opts), format: opts.format });
    } catch (err) {
      handleError(err, wantsJson(opts));
    }
  });
