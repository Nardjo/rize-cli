import { Command } from "commander";
import {
  graphql,
  unwrapConnection,
  assertPayloadErrors,
  row,
  csvList,
  intOpt,
  boolOpt,
  dayRange,
  wantsJson,
} from "../lib/graphql.js";
import { output } from "../lib/output.js";
import { handleError, CliError } from "../lib/errors.js";

const ENTRY_FIELDS = `
  id title description status source billable duration
  startTime endTime createdAt
  client { id name } project { id name } task { id name } team { id name }
`;

const SESSION_FIELDS = `
  id type title description source startTime endTime
  clients { id name } projects { id name } tasks { id name }
`;

interface ActionOpts {
  json?: boolean;
  format?: string;
  fields?: string;
  query?: string;
  status?: string;
  date?: string;
  start?: string;
  end?: string;
  startTime?: string;
  endTime?: string;
  clientIds?: string;
  projectIds?: string;
  taskIds?: string;
  first?: string;
  after?: string;
  title?: string;
  description?: string;
  clientId?: string;
  projectId?: string;
  taskId?: string;
  teamId?: string;
  billable?: string;
  idempotencyKey?: string;
  type?: string;
  length?: string;
  intention?: string;
}

export const timeEntriesResource = new Command("time-entries").description(
  "List, create, start, and stop Rize time entries / session timers",
);

timeEntriesResource
  .command("list")
  .description("List time entries")
  .option("--date <yyyy-mm-dd>", "Single UTC calendar day (sets start/end)")
  .option("--start <iso>", "Start time (ISO 8601)")
  .option("--end <iso>", "End time (ISO 8601)")
  .option("--query <text>", "Search title or description")
  .option(
    "--status <statuses>",
    "Comma-separated statuses: tracking,segmenting,active,pending,generating,failed,rejected",
  )
  .option("--client-ids <ids>", "Comma-separated client IDs")
  .option("--project-ids <ids>", "Comma-separated project IDs")
  .option("--task-ids <ids>", "Comma-separated task IDs")
  .option("--first <n>", "Page size", "20")
  .option("--after <cursor>", "Forward pagination cursor")
  .option("--fields <cols>", "Comma-separated columns to display")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .addHelpText(
    "after",
    "\nExamples:\n  rize-cli time-entries list --date 2026-08-20\n  rize-cli time-entries list --status active --json",
  )
  .action(async (opts: ActionOpts) => {
    try {
      let startTime = opts.start;
      let endTime = opts.end;
      if (opts.date) {
        const range = dayRange(opts.date);
        startTime = startTime ?? range.startTime;
        endTime = endTime ?? range.endTime;
      }
      const data = await graphql<{
        timeEntries?: { nodes?: Record<string, unknown>[]; pageInfo?: unknown };
      }>(
        `query TimeEntries(
          $startTime: ISO8601DateTime, $endTime: ISO8601DateTime, $query: String,
          $statuses: [TimeEntryStatusEnum!], $clientIds: [ID!], $projectIds: [ID!],
          $taskIds: [ID!], $first: Int, $after: String
        ) {
          timeEntries(
            startTime: $startTime, endTime: $endTime, query: $query,
            statuses: $statuses, clientIds: $clientIds, projectIds: $projectIds,
            taskIds: $taskIds, first: $first, after: $after
          ) {
            nodes { ${ENTRY_FIELDS} }
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
          }
        }`,
        {
          startTime,
          endTime,
          query: opts.query,
          statuses: csvList(opts.status),
          clientIds: csvList(opts.clientIds),
          projectIds: csvList(opts.projectIds),
          taskIds: csvList(opts.taskIds),
          first: intOpt(opts.first) ?? 20,
          after: opts.after,
        },
      );
      const nodes = unwrapConnection(data.timeEntries);
      const fields = opts.fields?.split(",") ?? [
        "id",
        "title",
        "status",
        "startTime",
        "duration",
        "client",
        "project",
      ];
      output(
        wantsJson(opts) ? { items: nodes, pageInfo: data.timeEntries?.pageInfo } : nodes.map((n) => row(n, fields)),
        { json: wantsJson(opts), format: opts.format, fields: opts.json ? undefined : fields },
      );
    } catch (err) {
      handleError(err, wantsJson(opts));
    }
  });

timeEntriesResource
  .command("get")
  .description("Get a time entry by ID")
  .argument("<id>", "Time entry ID")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .addHelpText("after", "\nExample:\n  rize-cli time-entries get 123")
  .action(async (id: string, opts: ActionOpts) => {
    try {
      const data = await graphql<{ timeEntry?: Record<string, unknown> | null }>(
        `query TimeEntry($id: ID!) { timeEntry(id: $id) { ${ENTRY_FIELDS} } }`,
        { id },
      );
      if (!data.timeEntry) throw new CliError(404, "Time entry not found");
      output(data.timeEntry, { json: wantsJson(opts), format: opts.format });
    } catch (err) {
      handleError(err, wantsJson(opts));
    }
  });

timeEntriesResource
  .command("create")
  .description("Create a time entry (start and end required)")
  .requiredOption("--start-time <iso>", "Start time (ISO 8601)")
  .requiredOption("--end-time <iso>", "End time (ISO 8601)")
  .option("--title <text>", "Title")
  .option("--description <text>", "Description")
  .option("--client-id <id>", "Client ID")
  .option("--project-id <id>", "Project ID")
  .option("--task-id <id>", "Task ID")
  .option("--team-id <id>", "Team ID")
  .option("--billable <bool>", "Billable true|false")
  .option("--idempotency-key <key>", "Idempotency key to avoid duplicates")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .addHelpText(
    "after",
    '\nExample:\n  rize-cli time-entries create --start-time 2026-08-20T09:00:00Z --end-time 2026-08-20T10:00:00Z --title "Deep work"',
  )
  .action(async (opts: ActionOpts) => {
    try {
      const data = await graphql<{
        createTimeEntry?: { timeEntry?: Record<string, unknown>; errors?: { message: string }[] };
      }>(
        `mutation CreateTimeEntry(
          $startTime: ISO8601DateTime!, $endTime: ISO8601DateTime!, $title: String,
          $description: String, $clientId: ID, $projectId: ID, $taskId: ID,
          $teamId: ID, $billable: Boolean, $idempotencyKey: String
        ) {
          createTimeEntry(input: {
            startTime: $startTime, endTime: $endTime, title: $title,
            description: $description, clientId: $clientId, projectId: $projectId,
            taskId: $taskId, teamId: $teamId, billable: $billable, idempotencyKey: $idempotencyKey
          }) {
            timeEntry { ${ENTRY_FIELDS} }
            errors { message path }
          }
        }`,
        {
          startTime: opts.startTime,
          endTime: opts.endTime,
          title: opts.title,
          description: opts.description,
          clientId: opts.clientId,
          projectId: opts.projectId,
          taskId: opts.taskId,
          teamId: opts.teamId,
          billable: boolOpt(opts.billable),
          idempotencyKey: opts.idempotencyKey,
        },
      );
      assertPayloadErrors(data.createTimeEntry);
      if (!data.createTimeEntry?.timeEntry) throw new CliError(1, "createTimeEntry returned no entry");
      output(data.createTimeEntry.timeEntry, { json: wantsJson(opts), format: opts.format });
    } catch (err) {
      handleError(err, wantsJson(opts));
    }
  });

timeEntriesResource
  .command("start")
  .description("Start a session timer (startSessionTimer)")
  .option("--type <type>", "Session type (e.g. focus, break)", "focus")
  .option("--title <text>", "Session title")
  .option("--intention <text>", "Intention / note")
  .option("--length <minutes>", "Planned length in minutes")
  .option("--client-ids <ids>", "Comma-separated client IDs")
  .option("--project-ids <ids>", "Comma-separated project IDs")
  .option("--task-ids <ids>", "Comma-separated task IDs")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .addHelpText("after", "\nExample:\n  rize-cli time-entries start --type focus --title \"Deep work\"")
  .action(async (opts: ActionOpts) => {
    try {
      const data = await graphql<{
        startSessionTimer?: { session?: Record<string, unknown>; errors?: { message: string }[] };
      }>(
        `mutation StartSessionTimer(
          $type: String!, $length: Int, $intention: String, $title: String,
          $projectIds: [ID!], $clientIds: [ID!], $taskIds: [ID!]
        ) {
          startSessionTimer(input: {
            type: $type, length: $length, intention: $intention, title: $title,
            projectIds: $projectIds, clientIds: $clientIds, taskIds: $taskIds
          }) {
            session { ${SESSION_FIELDS} }
            errors { message path }
          }
        }`,
        {
          type: opts.type ?? "focus",
          length: intOpt(opts.length),
          intention: opts.intention,
          title: opts.title,
          projectIds: csvList(opts.projectIds),
          clientIds: csvList(opts.clientIds),
          taskIds: csvList(opts.taskIds),
        },
      );
      assertPayloadErrors(data.startSessionTimer);
      if (!data.startSessionTimer?.session) throw new CliError(1, "startSessionTimer returned no session");
      output(data.startSessionTimer.session, { json: wantsJson(opts), format: opts.format });
    } catch (err) {
      handleError(err, wantsJson(opts));
    }
  });

timeEntriesResource
  .command("stop")
  .description("Stop the current session timer (stopSessionTimer)")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .addHelpText("after", "\nExample:\n  rize-cli time-entries stop")
  .action(async (opts: ActionOpts) => {
    try {
      const data = await graphql<{
        stopSessionTimer?: { session?: Record<string, unknown> | null; errors?: { message: string }[] };
      }>(
        `mutation StopSessionTimer {
          stopSessionTimer(input: {}) {
            session { ${SESSION_FIELDS} }
            errors { message path }
          }
        }`,
      );
      assertPayloadErrors(data.stopSessionTimer);
      output(data.stopSessionTimer?.session ?? { stopped: true }, { json: wantsJson(opts), format: opts.format });
    } catch (err) {
      handleError(err, wantsJson(opts));
    }
  });

timeEntriesResource
  .command("current")
  .description("Show the current session timer, if any")
  .option("--json", "Output as JSON")
  .option("--format <fmt>", "Output format: text, json, csv, yaml")
  .action(async (opts: ActionOpts) => {
    try {
      const data = await graphql<{ currentSession?: Record<string, unknown> | null }>(
        `query CurrentSession { currentSession { ${SESSION_FIELDS} } }`,
      );
      output(data.currentSession ?? { session: null }, { json: wantsJson(opts), format: opts.format });
    } catch (err) {
      handleError(err, wantsJson(opts));
    }
  });
