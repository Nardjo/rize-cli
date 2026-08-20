---
name: rize-cli
description: "Operate the Rize.io time tracker GraphQL API via rize-cli: auth, projects, clients, tasks, time entries (list/create/start/stop), and report runs. Use for time tracking, client/project lookup, and reading finished report runs."
category: "productivity"
---

# rize-cli

Agent-ready CLI for the Rize.io GraphQL API (`POST https://api.rize.io/api/v1/graphql`). Auth is a Bearer API key. This is the Rize time tracker (rize.io), not Rize Bank.

## When To Use This Skill

- List or look up clients, projects, and tasks (resolve names to IDs first)
- List, create, start, or stop time entries / session timers
- Read finished report runs instead of re-analyzing raw entries
- Test or inspect stored API auth

## Setup

```bash
bun --version || curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$HOME/.local/bin:$PATH"
npx api2cli bundle rize
npx api2cli link rize
```

CLI path after link: `~/.local/bin/rize-cli` → `~/.cli/rize-cli/dist/index.js`

Always pass `--json` for agent-driven calls.

## Authentication

```bash
rize-cli auth set "YOUR_API_KEY"
rize-cli auth test
rize-cli auth status
rize-cli auth show
rize-cli auth remove
```

Token file: `~/.config/tokens/rize-cli.txt` (`chmod 600`). Sent as `Authorization: Bearer <key>`.

`auth test` calls `currentUser { email }` and only reports whether the token is valid. Do not print the email or the key.

## Typical workflow

1. `rize-cli clients list --query acme --json` — pick a client `id`
2. `rize-cli projects list --client-id CLIENT_ID --json` — pick a project `id`
3. `rize-cli tasks list --project-ids PROJECT_ID --json` — pick a task `id`
4. Log time:
   ```bash
   rize-cli time-entries create \
     --start-time 2026-08-20T09:00:00Z \
     --end-time 2026-08-20T10:00:00Z \
     --title "Client work" \
     --client-id CLIENT_ID --project-id PROJECT_ID --json
   ```
5. Or start/stop a live session timer:
   ```bash
   rize-cli time-entries start --type focus --title "Deep work" --json
   rize-cli time-entries current --json
   rize-cli time-entries stop --json
   ```
6. `rize-cli time-entries list --date 2026-08-20 --json`
7. `rize-cli reports list --status ready --json` then `rize-cli reports get RUN_ID --json`

## Resources

Every resource command is a GraphQL operation against `POST /api/v1/graphql`. Do not invent REST paths.

### auth
| Command | Notes |
|---------|-------|
| `auth set [token]` | Token arg or stdin |
| `auth show` | Masked; `--raw` for full token |
| `auth remove` | Delete stored token |
| `auth status` | Configured? masked token only |
| `auth test` | `currentUser { email }` — success/fail only |

### projects
| Command | Flags |
|---------|-------|
| `projects list` | `--query`, `--status`, `--client-id`, `--first`, `--after` |
| `projects get <id>` | |

### clients
| Command | Flags |
|---------|-------|
| `clients list` | `--query`, `--status`, `--first`, `--after` |
| `clients get <id>` | |

### tasks
| Command | Flags |
|---------|-------|
| `tasks list` | `--query`, `--status`, `--project-ids`, `--assigned-to-me`, `--first`, `--after` |
| `tasks get <id>` | |

### time-entries
| Command | Flags |
|---------|-------|
| `time-entries list` | `--date YYYY-MM-DD` or `--start`/`--end` ISO, `--query`, `--status`, `--client-ids`, `--project-ids`, `--task-ids`, `--first`, `--after` |
| `time-entries get <id>` | |
| `time-entries create` | **required** `--start-time`, `--end-time`; optional `--title`, `--description`, `--client-id`, `--project-id`, `--task-id`, `--team-id`, `--billable true\|false`, `--idempotency-key` |
| `time-entries start` | `--type` (default `focus`), `--title`, `--intention`, `--length` minutes, `--client-ids`, `--project-ids`, `--task-ids` |
| `time-entries stop` | stops `currentSession` |
| `time-entries current` | current session timer |

Time entry statuses: `tracking`, `segmenting`, `active`, `pending`, `generating`, `failed`, `rejected`.

Times are ISO 8601. Prefer the user's timezone (from `currentUser.timezone`) over assuming UTC.

IDs, not names, for writes. Resolve names with `clients/projects/tasks list --query`.

### reports
| Command | Flags |
|---------|-------|
| `reports list` | `--report-id`, `--status pending\|running\|ready\|failed`, `--first`, `--after` |
| `reports get <id>` | includes analyses `summary` / `bodyMd` |

## Working Rules

- Prefer `--json` for all programmatic calls.
- Do not invent an API key; ask the user to run `auth set` if missing.
- Never print the API key or the user's email.
- Prefer read (`list`/`get`) before mutate (`create`/`start`/`stop`).
- All requests go to one GraphQL endpoint. Do not call fake REST paths.
- Pagination is cursor-based (`--first` / `--after`). Check `pageInfo.hasNextPage`.

## Output Format

`--json` envelope:

```json
{ "ok": true, "data": { ... }, "meta": { "total": 42 } }
```

Error: `{ "ok": false, "error": { "message": "...", "code": 401 } }`

## Global Flags

`--json`, `--format <text|json|csv|yaml>`, `--verbose`, `--no-color`, `--no-header`

Exit codes: 0 success, 1 API error, 2 usage error

## Quick Reference

```bash
rize-cli --help
rize-cli time-entries --help
rize-cli time-entries create --help
rize-cli reports list --help
```
