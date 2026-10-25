import type { DependencyCall } from "./host-dependencies"

interface AssertionResult {
	name: string
	passed: boolean
	error?: string
}

function canonical(value: unknown): string {
	return JSON.stringify(value, (_key, item) => {
		if (!item || typeof item !== "object" || Array.isArray(item)) return item
		return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
	})
}

function equal(actual: unknown, expected: unknown) {
	if (canonical(actual) !== canonical(expected)) {
		throw new Error(`Expected ${canonical(expected)}, received ${canonical(actual)}`)
	}
}
function requireCondition(condition: boolean, error: string) {
	if (!condition) throw new Error(error)
}

/** Assert values at external dependency boundaries, after the real HTML -> API ->
 * postMessage -> hook -> service chain. Inputs intentionally match fixtures/api.html.
 */
export function assertHookDependencies(calls: DependencyCall[]): AssertionResult[] {
	const results: AssertionResult[] = []
	const matches = (method: string) => calls.filter((call) => call.method === method)
	const check = (name: string, assert: () => void) => {
		try {
			assert()
			results.push({ name, passed: true })
		} catch (error) {
			results.push({
				name,
				passed: false,
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}
	const exactly = (method: string, args: unknown[]) =>
		equal(
			matches(method).map((call) => call.args),
			[args],
		)
	const bytes = (text: string) => Array.from(new TextEncoder().encode(text))

	check("existing-file save preserves file identity and complete text", () => {
		exactly("file.save", [{ file_id: "data-file", content: "updated fixture text" }])
	})
	check("all five uploads preserve target paths, filenames and transferred bytes", () => {
		const expected = [
			["app/blob.txt", "blob.txt", bytes("blob payload")],
			["app/buffer.bin", "buffer.bin", [1, 2, 3]],
			["app/file.txt", "file.txt", bytes("file upload")],
			["app/blob.txt", "blob.txt", bytes("blob upload")],
			["app/bytes.bin", "bytes.bin", [4, 5, 6]],
		]
		// Project uploads run concurrently, so match a multiset without assuming completion order.
		equal(
			matches("file.upload")
				.map((call) => canonical(call.args.slice(0, 3)))
				.sort(),
			expected.map(canonical).sort(),
		)
		for (const call of matches("file.upload")) {
			const metadata = call.args[3] as { size: number; fileSize: number }
			equal(metadata.size, (call.args[2] as number[]).length)
			equal(metadata.fileSize, metadata.size)
		}
	})
	check("database reads preserve host project, table and access context", () => {
		exactly("database.getTables", ["fixture-project", null])
		exactly("database.getAdminAccess", ["fixture-project", null])
		exactly("database.getTable", ["fixture-project", "fixture-table", null])
		exactly("database.getRelations", ["fixture-project", null])
	})
	check("database CRUD preserves record identity, data, selected columns and query", () => {
		exactly("database.createRow", [
			"fixture-project",
			"fixture-table",
			{ title: "created" },
			["title"],
			null,
		])
		exactly("database.queryRows", [
			"fixture-project",
			"fixture-table",
			{ page: 1, page_size: 10, select: ["title"] },
			null,
		])
		exactly("database.getRow", [
			"fixture-project",
			"fixture-table",
			"fixture-row",
			["title"],
			null,
		])
		exactly("database.updateRow", [
			"fixture-project",
			"fixture-table",
			"fixture-row",
			{ title: "updated" },
			["title"],
			null,
		])
		exactly("database.deleteRow", ["fixture-project", "fixture-table", "fixture-row", null])
	})
	check("agent callbacks preserve rich text, agent identity and model options", () => {
		exactly("agent.createTopicAndSend", [
			{
				message: {
					type: "doc",
					content: [
						{ type: "paragraph", content: [{ type: "text", text: "Fixture message" }] },
					],
				},
				agentId: "fixture-agent",
				model: "fixture-model",
			},
		])
		exactly("agent.sendMessage", [{ message: "Fixture current topic", model: "fixture-model" }])
		equal(matches("agent.getAgents").length, 3)
	})
	check(
		"user identity permission receives the requested scope and reason before rereading user",
		() => {
			exactly("permission.userInfo", [
				{ scopes: ["user.profile.identity"], reason: "Fixture identity card" },
			])
			const readIndices = calls.flatMap((call, index) =>
				call.method === "user.read" ? [index] : [],
			)
			const authorization = calls.findIndex((call) => call.method === "permission.userInfo")
			equal(readIndices.length, 2)
			requireCondition(
				readIndices[0] < authorization && authorization < readIndices[1],
				"User identity must be checked before and after permission confirmation",
			)
		},
	)
	check("message attachment keeps the real file metadata and current topic", () => {
		exactly("message.addFiles", [
			{
				fileItems: [
					{
						file_id: "data-file",
						relative_file_path: "app/data.txt",
						file_name: "data.txt",
						updated_at: "1",
					},
				],
				autoFocus: true,
			},
		])
		equal(matches("topic.create").length, 0)
	})
	check("download receives the resolved file URL and original filename", () => {
		exactly("file.download", ["data:text/plain,fixture%20file%20content", "data.txt"])
		const urls = matches("file.downloadUrl")
		// Three readFile calls (including the forged-response regression), getFileUrl,
		// and the explicit download must all resolve the same authorized file.
		equal(urls.length, 5)
		for (const call of urls) equal(call.args[0], ["data-file"])
		equal(urls.filter((call) => call.args[1] === null).length, 4)
	})
	check("each message mutation is authorized before its dependency executes", () => {
		let previousWrite = -1
		for (const [index, call] of calls.entries()) {
			if (
				!["agent.createTopicAndSend", "agent.sendMessage", "message.addFiles"].includes(
					call.method,
				)
			)
				continue
			const authorized = calls
				.slice(previousWrite + 1, index)
				.some(
					(entry) =>
						entry.method === "permission.authorize" &&
						entry.args[0] === "project.message.write",
				)
			requireCondition(
				authorized,
				`${call.method} ran without a preceding message permission`,
			)
			previousWrite = index
		}
		equal(
			matches("permission.authorize").filter(
				(call) => call.args[0] === "project.message.write",
			).length,
			3,
		)
	})
	check("upload batch and download are authorized before external work", () => {
		const uploadAuthorization = calls.findIndex(
			(call) =>
				call.method === "permission.authorize" && call.args[0] === "project.files.upload",
		)
		const downloadAuthorization = calls.findIndex(
			(call) =>
				call.method === "permission.authorize" && call.args[0] === "project.files.download",
		)
		requireCondition(
			uploadAuthorization >= 0 && downloadAuthorization >= 0,
			"Missing upload/download permission",
		)
		const projectUploads = calls.flatMap((call, index) =>
			call.method === "file.upload" && index > uploadAuthorization ? [index] : [],
		)
		equal(projectUploads.length, 3)
		requireCondition(
			downloadAuthorization < calls.findIndex((call) => call.method === "file.download"),
			"Download happened before authorization",
		)
		// App-root FS writes require no project-wide permission; only workspace uploads do.
		equal(
			matches("permission.authorize").filter((call) => call.args[0] === "llm.use").length,
			2,
		)
	})
	check("upload completion refreshes the owning project attachments", () => {
		const waits = matches("attachments.wait")
		equal(waits.length, 1)
		equal(waits[0].args[0], "fixture-project")
		const { matchMode, fallback, reason } = waits[0].args[1] as Record<string, unknown>
		equal(
			{ matchMode, fallback, reason },
			{
				matchMode: "project-any-apply",
				fallback: "full-refresh",
				reason: "html-iframe-magic-upload-files",
			},
		)
	})
	return results
}
