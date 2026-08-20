# rize-cli

CLI for the [Rize.io](https://rize.io) time tracker API. Made with [api2cli.dev](https://api2cli.dev).

Talks to the GraphQL API at `https://api.rize.io/api/v1/graphql` (not REST).

## Install

```bash
npx api2cli install Nardjo/rize-cli
```

This clones the repo, builds the CLI, links it to your PATH, and installs the AgentSkill to your coding agents.

## Install AgentSkill only

```bash
npx skills add Nardjo/rize-cli
```

## Auth

Generate an API key in Rize Settings > API, then:

```bash
rize-cli auth set "your-api-key"
rize-cli auth test
rize-cli auth status
```

Token is stored in `~/.config/tokens/rize-cli.txt` (`chmod 600`) and sent as `Authorization: Bearer <key>`.

## Quick start

```bash
rize-cli projects list --json
rize-cli clients list --json
rize-cli tasks list --json
rize-cli time-entries list --date 2026-08-20 --json
rize-cli time-entries create \
  --start-time 2026-08-20T09:00:00Z \
  --end-time 2026-08-20T10:00:00Z \
  --title "Deep work" --json
rize-cli time-entries start --type focus --title "Focus block"
rize-cli time-entries stop
rize-cli reports list --status ready --json
```

## Resources

| Resource       | Actions                                      |
|----------------|----------------------------------------------|
| `auth`         | `set`, `show`, `remove`, `status`, `test`    |
| `projects`     | `list`, `get`                                |
| `clients`      | `list`, `get`                                |
| `tasks`        | `list`, `get`                                |
| `time-entries` | `list`, `get`, `create`, `start`, `stop`, `current` |
| `reports`      | `list`, `get`                                |

Run `rize-cli <resource> --help` for flags.

All list/get/create calls are `POST /api/v1/graphql` with `{ query, variables }`.

## Global Flags

All commands support: `--json`, `--format <text|json|csv|yaml>`, `--verbose`, `--no-color`, `--no-header`

## Docs

- GraphQL intro: https://docs.rize.io/graphql-api/graphql-intro
- Auth: https://docs.rize.io/graphql-api/graphql-auth
- Examples: https://docs.rize.io/graphql-api/graphql-examples
- Pagination: https://docs.rize.io/graphql-api/graphql-pagination
- Playground: https://api.rize.io/api/v1/graphiql
- Agent skill: `skills/rize-cli/SKILL.md`
