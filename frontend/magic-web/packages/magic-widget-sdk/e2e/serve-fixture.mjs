import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const port = Number(process.env.WIDGET_E2E_FIXTURE_PORT ?? 4317)
const fixturePath = resolve(fileURLToPath(new URL("./fixtures/widget-host.html", import.meta.url)))

/** Serves the isolated host fixture without coupling the E2E project to Magic Web routing. */
const server = createServer(async (request, response) => {
	if (request.url === "/healthz") {
		response.writeHead(200, { "content-type": "text/plain; charset=utf-8" })
		response.end("ok")
		return
	}

	if (request.url === "/" || request.url?.startsWith("/?")) {
		response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
		response.end(await readFile(fixturePath, "utf8"))
		return
	}

	response.writeHead(404)
	response.end("Not found")
})

server.listen(port, "127.0.0.1")
