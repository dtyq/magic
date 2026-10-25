import { join } from "node:path";

/** Connection config fields injected into the page; values come from WIDGET_EXAMPLE_* env vars. */
interface ExampleEnv {
	appUrl: string;
	crewId: string;
	deploymentCode: string;
	organizationCode: string;
	loginStrategy: string;
}

/** Reads a required env var and throws a clear error when it is missing or blank. */
function readRequiredEnv(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(
			`Missing required environment variable: ${name}. ` +
				`Copy .env.example to .env and fill it in.`,
		);
	}
	return value;
}

/** Reads an optional env var, returning "" when unset so optional fields are omitted from the page. */
function readOptionalEnv(name: string): string {
	return process.env[name]?.trim() ?? "";
}

/** Loads and validates all connection configuration from the environment. */
function loadEnv(): ExampleEnv {
	return {
		appUrl: readRequiredEnv("WIDGET_EXAMPLE_APP_URL"),
		crewId: readRequiredEnv("WIDGET_EXAMPLE_CREW_ID"),
		deploymentCode: readOptionalEnv("WIDGET_EXAMPLE_DEPLOYMENT_CODE"),
		organizationCode: readOptionalEnv("WIDGET_EXAMPLE_ORGANIZATION_CODE"),
		loginStrategy: readOptionalEnv("WIDGET_EXAMPLE_LOGIN_STRATEGY") || "private_deployment",
	};
}

/**
 * Builds the SDK script URL from the app URL, stripping any trailing slash so the
 * path is always `${appUrl}/sdk/magic-widget.js`.
 */
function buildSdkUrl(appUrl: string): string {
	return `${appUrl.replace(/\/+$/, "")}/sdk/magic-widget.js`;
}

/**
 * Serializes the connection config for inline injection. The `<` character is escaped
 * to `<` so a value can never terminate the surrounding `<script>` element.
 */
function serializeEnv(env: ExampleEnv): string {
	const payload = {
		crewId: env.crewId,
		deploymentCode: env.deploymentCode,
		organizationCode: env.organizationCode,
		loginStrategy: env.loginStrategy,
	};
	return JSON.stringify(payload).replace(/</g, "\\u003c");
}

/** Replaces the page placeholders with server-computed values. */
function renderHtml(template: string, sdkUrl: string, envJson: string): string {
	return template
		.replace("{{SDK_URL}}", sdkUrl)
		.replace("{{EXAMPLE_ENV_JSON}}", envJson);
}

const env = loadEnv();
const sdkUrl = buildSdkUrl(env.appUrl);
const envJson = serializeEnv(env);
const port = Number(process.env.WIDGET_EXAMPLE_PORT ?? 4318);
const hostname = process.env.WIDGET_EXAMPLE_HOST ?? "127.0.0.1";

// The template is read on every request instead of being cached at startup, so editing
// index.html takes effect on the next browser refresh without restarting the process.
const pagePath = join(import.meta.dir, "index.html");

/**
 * Serves the rendered example page plus a health check endpoint.
 *
 * The port being taken by a previous run is the most common local failure, so the failure
 * is reported with the exact command that frees the port. The example intentionally does
 * not fall back to the next free port: a browser tab on the documented port would then
 * silently keep talking to the stale instance instead of the server just started.
 */
function startServer(): void {
	try {
		Bun.serve({
			port,
			hostname,
			async fetch(request) {
				const url = new URL(request.url);

				if (url.pathname === "/healthz") {
					return new Response("ok", {
						headers: { "content-type": "text/plain; charset=utf-8" },
					});
				}

				if (url.pathname === "/" || url.pathname === "/index.html") {
					const template = await Bun.file(pagePath).text();
					return new Response(renderHtml(template, sdkUrl, envJson), {
						headers: { "content-type": "text/html; charset=utf-8" },
					});
				}

				return new Response("Not found", { status: 404 });
			},
		});
	} catch (error) {
		// Bun throws a SystemError carrying the socket errno code; only that case gets advice.
		if ((error as { code?: string }).code === "EADDRINUSE") {
			console.error(
				`Port ${port} on ${hostname} is already in use. ` +
					`Stop the process holding it (lsof -nP -iTCP:${port} -sTCP:LISTEN) ` +
					`or start this example elsewhere with WIDGET_EXAMPLE_PORT=<port>.`,
			);
			process.exit(1);
		}
		throw error;
	}
}

startServer();

console.log(`Magic Widget SDK example listening on http://${hostname}:${port}`);
console.log(`SDK script: ${sdkUrl}`);
