import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MagicFilesApi } from "../MagicFilesApi"
import { MagicWorkspaceApi } from "../MagicWorkspaceApi"
import { callMagic, createMagicApiHarness, getMagicMember } from "./magic-api-test-helpers"

// MagicFilesApi.test.ts already covers the re-export's payload and input validation.
// These cases cover the modern namespace and binary/validation gaps in that suite.
describe("MagicWorkspaceApi namespace and upload contracts", () => {
	let host: ReturnType<typeof createMagicApiHarness>
	beforeEach(() => {
		host = createMagicApiHarness()
		vi.useFakeTimers()
		new MagicWorkspaceApi().install()
	})
	afterEach(() => host.cleanup())

	it("keeps the old class import as a direct alias", () => {
		expect(MagicFilesApi).toBe(MagicWorkspaceApi)
	})

	it.each(["uploadFiles", "addFilesToMessage", "downloadFiles"])(
		"installs project.%s and its old alias without replacing existing methods",
		(method) => {
			const installed = getMagicMember(`project.${method}`)
			expect(installed).toBeTypeOf("function")
			expect(installed).toBe(getMagicMember(method))
			new MagicWorkspaceApi().install()
			expect(getMagicMember(`project.${method}`)).toBe(installed)
		},
	)

	it("preserves existing project methods while filling missing operations", () => {
		const uploadFiles = vi.fn()
		const downloadFiles = vi.fn()
		const sendMessage = vi.fn()
		window.Magic = { project: { uploadFiles, sendMessage }, downloadFiles }
		new MagicWorkspaceApi().install()
		expect(window.Magic.project?.uploadFiles).toBe(uploadFiles)
		expect(window.Magic.project?.sendMessage).toBe(sendMessage)
		expect(window.Magic.downloadFiles).toBe(downloadFiles)
		expect(window.Magic.project?.downloadFiles).toBeTypeOf("function")
	})

	it("uploads mixed File, Blob and ArrayBuffer values and transfers only buffers", async () => {
		const files = [
			new File(["hello"], "a.txt", { type: "text/plain" }),
			new Blob(["data"], { type: "application/octet-stream" }),
			new ArrayBuffer(8),
		]
		const pending = callMagic(
			"project.uploadFiles",
			files.map((file, index) => ({
				file,
				path: `./${index}`,
				filename: `${index}.bin`,
			})),
		)
		expect(host.latestRequest()).toMatchObject({
			type: "MAGIC_UPLOAD_FILES_REQUEST",
			files: files.map((file, index) => ({
				file,
				path: `./${index}`,
				filename: `${index}.bin`,
				fileSize: file instanceof ArrayBuffer ? 8 : file.size,
				fileType: file instanceof ArrayBuffer ? "" : file.type,
			})),
		})
		expect(host.postMessage.mock.calls[0][2]).toEqual([files[2]])
		const results = [{ path: "./0", success: true }]
		host.respond({ results })
		await expect(pending).resolves.toEqual(results)
	})

	it.each([null, "file", 42])(
		"rejects a non-object upload item %j without sending partial files",
		async (item) => {
			await expect(
				callMagic("project.uploadFiles", [
					{ file: new Blob(["ok"]), path: "./ok", filename: "ok" },
					item,
				]),
			).rejects.toThrow("files[1] must be an object")
			expect(host.postMessage).not.toHaveBeenCalled()
			expect(host.pendingListeners()).toHaveLength(0)
		},
	)

	it.each([null, 42, {}, []])("rejects invalid agentMode %j", async (agentMode) => {
		await expect(callMagic("project.addFilesToMessage", ["./a"], agentMode)).rejects.toThrow(
			"agentMode must be a string",
		)
		expect(host.postMessage).not.toHaveBeenCalled()
	})
})
