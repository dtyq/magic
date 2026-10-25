import { createRequire } from "node:module"
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { buildFixtures, outputRoot } from "./build-fixtures"

const { setHtmlSandboxRuntimeCorsHeaders } = createRequire(import.meta.url)(
	"../../server/utils/htmlSandboxRuntimeCors.cjs",
) as {
	setHtmlSandboxRuntimeCorsHeaders: (
		response: import("node:http").ServerResponse,
		requestOrigin: string | undefined,
		allowedOrigins: string[],
	) => void
}

export async function serveFixtures() {
	await buildFixtures()
	const resourceRequests: string[] = []
	const runtimeAllowedOrigins: string[] = []
	const mime: Record<string, string> = {
		".html": "text/html; charset=utf-8",
		".js": "text/javascript",
		".json": "application/json",
		".css": "text/css",
		".svg": "image/svg+xml",
	}
	const server = createServer(async (req, res) => {
		try {
			const path = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname)
			// Never let native relative loading pass the interception tests, even
			// if an old generated resource remains from a previous fixture build.
			if (/^\/resource\./.test(path)) {
				res.writeHead(404).end("Resource requires host URL resolution")
				return
			}
			if (
				path === "/resolved-assets/resource-xhr.json" ||
				path === "/resolved-assets/resource-abort.json" ||
				path === "/resource-test-state"
			) {
				res.setHeader("Access-Control-Allow-Origin", "*")
				res.setHeader(
					"Access-Control-Allow-Headers",
					"x-fixture-id, x-fixture-values, content-type",
				)
				res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				res.setHeader("Cache-Control", "no-store")
				if (req.method === "OPTIONS") {
					res.writeHead(204).end()
					return
				}
				res.setHeader("Content-Type", "application/json")
				if (path === "/resource-test-state") {
					const prefix =
						new URL(req.url || "/", "http://localhost").searchParams.get("prefix") || ""
					res.end(JSON.stringify(resourceRequests.filter((id) => id.startsWith(prefix))))
					return
				}
				const marker = String(req.headers["x-fixture-id"] || "")
				resourceRequests.push(marker)
				let body = ""
				for await (const chunk of req) body += chunk
				res.end(
					JSON.stringify({
						method: req.method,
						body,
						marker,
						values: req.headers["x-fixture-values"] || "",
					}),
				)
				return
			}
			// LLM service remains real, including token exchange and SSE parsing.
			// Only the remote gateway is replaced by this deterministic HTTP fixture.
			if (path === "/api/v1/model-gateway/tokens") {
				if (
					req.method !== "POST" ||
					req.headers.authorization !== "fixture-authorization" ||
					req.headers["organization-code"] !== "fixture-org"
				) {
					res.writeHead(400).end("Invalid token request contract")
					return
				}
				res.setHeader("Content-Type", "application/json")
				res.end(JSON.stringify({ data: { api_key: "fixture-key", expires_in: 3600 } }))
				return
			}
			if (path === "/v1/models") {
				if (req.method !== "GET" || req.headers["api-key"] !== "fixture-key") {
					res.writeHead(400).end("Invalid models request contract")
					return
				}
				res.setHeader("Content-Type", "application/json")
				res.end(JSON.stringify({ data: [{ id: "fixture-model" }] }))
				return
			}
			if (path === "/v1/chat/completions") {
				let body = ""
				for await (const chunk of req) body += chunk
				const input = JSON.parse(body)
				if (
					req.method !== "POST" ||
					req.headers["api-key"] !== "fixture-key" ||
					input.model !== "fixture-model" ||
					input.messages?.[0]?.role !== "user" ||
					input.messages?.[0]?.content !==
						(input.stream ? "Fixture stream" : "Fixture question")
				) {
					res.writeHead(400).end("Invalid completion request contract")
					return
				}
				if (input.stream) {
					res.setHeader("Content-Type", "text/event-stream")
					for (const content of ["fixture ", "reply"])
						res.write(
							"data: " +
								JSON.stringify({ choices: [{ delta: { content } }] }) +
								"\n\n",
						)
					res.end("data: [DONE]\n\n")
				} else {
					res.setHeader("Content-Type", "application/json")
					res.end(
						JSON.stringify({
							choices: [{ message: { content: "fixture reply" } }],
							model: "fixture-model",
						}),
					)
				}
				return
			}
			const file = resolve(outputRoot, "." + (path === "/" ? "/index.html" : path))
			if (!file.startsWith(outputRoot + sep)) {
				res.writeHead(403).end()
				return
			}
			res.setHeader("Content-Type", mime[extname(file)] || "application/octet-stream")
			if (path === "/husky-runtime.js")
				setHtmlSandboxRuntimeCorsHeaders(res, req.headers.origin, runtimeAllowedOrigins)
			else res.setHeader("Access-Control-Allow-Origin", "*")
			res.setHeader("Cache-Control", "no-store")
			res.end(await readFile(file))
		} catch {
			res.writeHead(404).end("Fixture not found")
		}
	})
	// IPv4 loopback only; 127.0.0.1 and localhost provide distinct test origins.
	await new Promise<void>((done, reject) => {
		server.once("error", reject)
		server.listen(0, "127.0.0.1", done)
	})
	const address = server.address()
	if (!address || typeof address === "string") throw new Error("No fixture server port")
	// Match production allowlist semantics with only this run's two loopback origins.
	runtimeAllowedOrigins.push(
		`http://127.0.0.1:${address.port}`,
		`http://localhost:${address.port}`,
	)
	return { server, url: `http://127.0.0.1:${address.port}` }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const { server, url } = await serveFixtures()
	console.log(`HTML sandbox fixtures: ${url}\nPress Ctrl+C to close the fixture server.`)
	for (const signal of ["SIGINT", "SIGTERM"] as const)
		process.once(signal, () => {
			server.closeAllConnections()
			server.close()
		})
}
