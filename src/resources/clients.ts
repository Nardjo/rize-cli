import { Command } from "commander";
import { graphql, unwrapConnection, row, intOpt, wantsJson } from "../lib/graphql.js";
import { output } from "../lib/output.js";
import { handleError, CliError } from "../lib/errors.js";

const CLIENT_FIELDS = `
  id name status color emoji hourlyRate lastUsedAt
  team { id name }
`;

interface ActionOpts {
  json?: boolean;
  format?: string;
  fields?: string;
  query?: string;
  status?: string;
  first?: string;
  after?: string;
}

export const clientsResource = new Command("clients").description(
  "List and inspect Rize clients",
);

clientsResource
  .command("list")
  .description("List clients")
  .option("--query <text>", "Search by name")
  .option("--status <statuses>", "Comma-separated statuses (default: active)")
  .option("--first <n>", "Page size", "20")
  .option("--after <cursor>", "Forward pagination cursor")
  .option("--fields <cols>", "Comma-separated columns to display")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .addHelpText("after", "\nExamples:\n  rize-cli clients list\n  rize-cli clients list --query acme --json")
  .action(async (opts: ActionOpts) => {
    try {
      const statuses = opts.status?.split(",").map((s) => s.trim()).filter(Boolean);
      const data = await graphql<{
        clients?: { nodes?: Record<string, unknown>[]; pageInfo?: unknown };
      }>(
        `query Clients($query: String, $statuses: [String!], $first: Int, $after: String) {
          clients(query: $query, statuses: $statuses, first: $first, after: $after) {
            nodes { ${CLIENT_FIELDS} }
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
          }
        }`,
        {
          query: opts.query,
          statuses,
          first: intOpt(opts.first) ?? 20,
          after: opts.after,
        },
      );
      const nodes = unwrapConnection(data.clients);
      const fields = opts.fields?.split(",") ?? ["id", "name", "status", "hourlyRate"];
      output(
        wantsJson(opts) ? { items: nodes, pageInfo: data.clients?.pageInfo } : nodes.map((n) => row(n, fields)),
        { json: wantsJson(opts), format: opts.format, fields: opts.json ? undefined : fields },
      );
    } catch (err) {
      handleError(err, wantsJson(opts));
    }
  });

clientsResource
  .command("get")
  .description("Get a client by ID")
  .argument("<id>", "Client ID")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .addHelpText("after", "\nExample:\n  rize-cli clients get 123")
  .action(async (id: string, opts: ActionOpts) => {
    try {
      const data = await graphql<{ client?: Record<string, unknown> | null }>(
        `query Client($id: ID!) { client(id: $id) { ${CLIENT_FIELDS} } }`,
        { id },
      );
      if (!data.client) throw new CliError(404, "Client not found");
      output(data.client, { json: wantsJson(opts), format: opts.format });
    } catch (err) {
      handleError(err, wantsJson(opts));
    }
  });
