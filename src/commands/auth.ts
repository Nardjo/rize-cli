import { Command } from "commander";
import { getToken, setToken, removeToken, hasToken, maskToken } from "../lib/auth.js";
import { graphql } from "../lib/graphql.js";
import { TOKEN_PATH, globalFlags } from "../lib/config.js";
import { log } from "../lib/logger.js";
import { output } from "../lib/output.js";
import { handleError, CliError } from "../lib/errors.js";

export const authCommand = new Command("auth").description("Manage API authentication");

authCommand
  .command("set")
  .description("Save your Rize API key")
  .argument("[token]", "API key (omit to read from stdin)")
  .addHelpText("after", "\nExample:\n  rize-cli auth set \"$RIZE_API_KEY\"\n  printf '%s' \"$RIZE_API_KEY\" | rize-cli auth set")
  .action(async (token?: string) => {
    try {
      let value = token?.trim() ?? "";
      if (!value && !process.stdin.isTTY) {
        value = (await Bun.stdin.text()).trim();
      }
      if (!value) {
        throw new CliError(2, "No token provided.", "Run: rize-cli auth set <token>");
      }
      setToken(value);
      log.success("Token saved securely");
    } catch (err) {
      handleError(err);
    }
  });

authCommand
  .command("show")
  .description("Display current token (masked by default)")
  .option("--raw", "Show the full unmasked token")
  .addHelpText("after", "\nExample:\n  rize-cli auth show\n  rize-cli auth show --raw")
  .action((opts: { raw?: boolean }) => {
    if (!hasToken()) {
      log.warn("No token configured. Run: rize-cli auth set <token>");
      return;
    }
    const token = getToken();
    console.log(opts.raw ? token : `Token: ${maskToken(token)}`);
  });

authCommand
  .command("remove")
  .description("Delete the saved token")
  .addHelpText("after", "\nExample:\n  rize-cli auth remove")
  .action(() => {
    removeToken();
    log.success("Token removed");
  });

authCommand
  .command("status")
  .description("Show whether a token is configured (does not print the key)")
  .option("--json", "Output as JSON")
  .action((opts: { json?: boolean }) => {
    const configured = hasToken();
    const data = {
      configured,
      tokenPath: TOKEN_PATH,
      token: configured ? maskToken(getToken()) : null,
    };
    if (opts.json || globalFlags.json) {
      output(data, { json: true });
      return;
    }
    if (!configured) {
      log.warn("No token configured. Run: rize-cli auth set <token>");
      return;
    }
    log.info(`Token: ${data.token}`);
    log.info(`Path:  ${TOKEN_PATH}`);
  });

authCommand
  .command("test")
  .description("Verify your token with currentUser { email }")
  .option("--json", "Output as JSON")
  .addHelpText("after", "\nExample:\n  rize-cli auth test")
  .action(async (opts: { json?: boolean }) => {
    try {
      const data = await graphql<{ currentUser?: { email?: string } | null }>(
        "query CurrentUser { currentUser { email } }",
      );
      if (!data.currentUser) {
        throw new CliError(401, "currentUser returned null");
      }
      const result = { authenticated: true };
      if (opts.json || globalFlags.json) {
        output(result, { json: true });
      } else {
        log.success("Token is valid");
      }
    } catch (err) {
      handleError(err, opts.json);
    }
  });
