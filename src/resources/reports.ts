import { Command } from "commander";
import { graphql, unwrapConnection, row, intOpt, wantsJson } from "../lib/graphql.js";
import { output } from "../lib/output.js";
import { handleError, CliError } from "../lib/errors.js";

const RUN_FIELDS = `
  id publicId status startTime endTime errorMessage trigger createdAt
  report { id name scope cadence outputFormat }
  analyses { id status summary bodyMd }
`;

interface ActionOpts {
  json?: boolean;
  format?: string;
  fields?: string;
  reportId?: string;
  status?: string;
  first?: string;
  after?: string;
}

export const reportsResource = new Command("reports").description(
  "Read Rize report runs",
);

reportsResource
  .command("list")
  .description("List report runs")
  .option("--report-id <id>", "Filter to one report")
  .option("--status <status>", "pending | running | ready | failed")
  .option("--first <n>", "Page size", "10")
  .option("--after <cursor>", "Forward pagination cursor")
  .option("--fields <cols>", "Comma-separated columns to display")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .addHelpText("after", "\nExamples:\n  rize-cli reports list --status ready\n  rize-cli reports list --json")
  .action(async (opts: ActionOpts) => {
    try {
      const data = await graphql<{
        reportRuns?: { nodes?: Record<string, unknown>[]; pageInfo?: unknown };
      }>(
        `query ReportRuns($reportId: ID, $status: String, $first: Int, $after: String) {
          reportRuns(reportId: $reportId, status: $status, first: $first, after: $after) {
            nodes { ${RUN_FIELDS} }
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
          }
        }`,
        {
          reportId: opts.reportId,
          status: opts.status,
          first: intOpt(opts.first) ?? 10,
          after: opts.after,
        },
      );
      const nodes = unwrapConnection(data.reportRuns);
      const fields = opts.fields?.split(",") ?? ["id", "publicId", "status", "startTime", "endTime", "report"];
      output(
        wantsJson(opts) ? { items: nodes, pageInfo: data.reportRuns?.pageInfo } : nodes.map((n) => row(n, fields)),
        { json: wantsJson(opts), format: opts.format, fields: opts.json ? undefined : fields },
      );
    } catch (err) {
      handleError(err, wantsJson(opts));
    }
  });

reportsResource
  .command("get")
  .description("Get a report run by ID")
  .argument("<id>", "Report run ID")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .addHelpText("after", "\nExample:\n  rize-cli reports get <run-id>")
  .action(async (id: string, opts: ActionOpts) => {
    try {
      const data = await graphql<{ reportRun?: Record<string, unknown> | null }>(
        `query ReportRun($id: ID!) { reportRun(id: $id) { ${RUN_FIELDS} } }`,
        { id },
      );
      if (!data.reportRun) throw new CliError(404, "Report run not found");
      output(data.reportRun, { json: wantsJson(opts), format: opts.format });
    } catch (err) {
      handleError(err, wantsJson(opts));
    }
  });
