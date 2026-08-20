import { Command } from "commander";
import { graphql, unwrapConnection, row, intOpt, wantsJson } from "../lib/graphql.js";
import { output } from "../lib/output.js";
import { handleError, CliError } from "../lib/errors.js";

const PROJECT_FIELDS = `
  id name status color emoji lastUsedAt
  client { id name } team { id name }
`;

interface ActionOpts {
  json?: boolean;
  format?: string;
  fields?: string;
  query?: string;
  status?: string;
  clientId?: string;
  first?: string;
  after?: string;
}

export const projectsResource = new Command("projects").description(
  "List and inspect Rize projects",
);

projectsResource
  .command("list")
  .description("List projects")
  .option("--query <text>", "Search by name")
  .option("--status <statuses>", "Comma-separated statuses (default: in_progress,completed)")
  .option("--client-id <id>", "Filter by client ID")
  .option("--first <n>", "Page size", "20")
  .option("--after <cursor>", "Forward pagination cursor")
  .option("--fields <cols>", "Comma-separated columns to display")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .addHelpText("after", "\nExamples:\n  rize-cli projects list\n  rize-cli projects list --query acme --json")
  .action(async (opts: ActionOpts) => {
    try {
      const statuses = opts.status?.split(",").map((s) => s.trim()).filter(Boolean);
      const data = await graphql<{
        projects?: { nodes?: Record<string, unknown>[]; pageInfo?: unknown };
      }>(
        `query Projects($query: String, $statuses: [String!], $clientId: ID, $first: Int, $after: String) {
          projects(query: $query, statuses: $statuses, clientId: $clientId, first: $first, after: $after) {
            nodes { ${PROJECT_FIELDS} }
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
          }
        }`,
        {
          query: opts.query,
          statuses,
          clientId: opts.clientId,
          first: intOpt(opts.first) ?? 20,
          after: opts.after,
        },
      );
      const nodes = unwrapConnection(data.projects);
      const fields = opts.fields?.split(",") ?? ["id", "name", "status", "client"];
      output(
        wantsJson(opts) ? { items: nodes, pageInfo: data.projects?.pageInfo } : nodes.map((n) => row(n, fields)),
        { json: wantsJson(opts), format: opts.format, fields: opts.json ? undefined : fields },
      );
    } catch (err) {
      handleError(err, wantsJson(opts));
    }
  });

projectsResource
  .command("get")
  .description("Get a project by ID")
  .argument("<id>", "Project ID")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .addHelpText("after", "\nExample:\n  rize-cli projects get 124119")
  .action(async (id: string, opts: ActionOpts) => {
    try {
      const data = await graphql<{ project?: Record<string, unknown> | null }>(
        `query Project($id: ID!) { project(id: $id) { ${PROJECT_FIELDS} } }`,
        { id },
      );
      if (!data.project) throw new CliError(404, "Project not found");
      output(data.project, { json: wantsJson(opts), format: opts.format });
    } catch (err) {
      handleError(err, wantsJson(opts));
    }
  });
