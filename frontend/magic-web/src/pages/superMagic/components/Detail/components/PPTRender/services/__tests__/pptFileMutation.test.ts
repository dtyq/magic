import { beforeEach, describe, expect, it, vi } from "vitest"
import { MagicFSApi, SuperMagicApi } from "@/apis"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { createPPTFileMutationClient } from "../pptFileMutation"

vi.mock("@/apis", () => ({
	MagicFSApi: { getFileInfo: vi.fn() },
	SuperMagicApi: { saveFileContent: vi.fn() },
}))

const getInfo = vi.mocked(MagicFSApi.getFileInfo)
const saveContent = vi.mocked(SuperMagicApi.saveFileContent)
const getContent = vi.fn<FileApi["getFileContentById"]>()
const isCurrent = vi.fn(() => true)

function metadata(version = 1) {
	return {
		file: {
			id: "slide-1",
			name: "1.html",
			parent_id: "deck",
			is_directory: false,
			size: 10,
			mode: 420,
			file_metadata: {},
			created_at: "",
			updated_at: "",
			version,
			latest_version: 1,
		},
	}
}

function client(identityKey = "session:project:topic") {
	const fileApi: FileApi = {
		identityKey,
		getFileContentById: getContent,
		getFileContentsByIds: vi.fn(),
		getTemporaryDownloadUrl: vi.fn(),
		requestSharedMediaUrls: vi.fn(),
	}
	return createPPTFileMutationClient(fileApi, { isCurrent })
}

function success(fileId = "slide-1", revision = 2) {
	return {
		batch_id: "batch",
		completed_at: "",
		total: 1,
		success: 1,
		error: 0,
		success_files: [
			{
				index: 0,
				file_id: fileId,
				status: "success",
				data: { file_id: fileId, size: 10, updated_at: "", revision },
				duration_ms: 1,
			},
		],
		error_files: [],
	}
}

describe("PPT file mutation", () => {
	beforeEach(() => {
		vi.resetAllMocks()
		isCurrent.mockReturnValue(true)
		getInfo.mockResolvedValue(metadata())
		getContent.mockResolvedValue("original")
		saveContent.mockResolvedValue(success())
	})

	it("retries a changing read and preserves its original revision when saving", async () => {
		getInfo.mockResolvedValue(metadata(2))
		getInfo.mockResolvedValueOnce(metadata(1)).mockResolvedValueOnce(metadata(2))
		saveContent.mockResolvedValue(success("slide-1", 3))
		const mutation = client()
		const signal = new AbortController().signal
		const snapshot = await mutation.read("slide-1", signal)
		expect(snapshot).toEqual({ fileId: "slide-1", content: "original", revision: 2 })
		expect(getContent).toHaveBeenCalledTimes(2)
		expect(getContent).toHaveBeenCalledWith("slide-1", {
			responseType: "text",
			forceRefresh: true,
			signal,
		})
		await mutation.save(snapshot, "replacement")
		expect(saveContent).toHaveBeenCalledWith([
			{ file_id: "slide-1", content: "replacement", expected_revision: 2 },
		])
	})

	it.each(["revision", "content"])(
		"refuses a changed %s before sending a write",
		async (change) => {
			const mutation = client()
			const snapshot = await mutation.read("slide-1")
			if (change === "revision") getInfo.mockResolvedValue(metadata(2))
			else getContent.mockResolvedValue("AI changed content before metadata advanced")
			await expect(mutation.save(snapshot, "replacement")).rejects.toMatchObject({
				kind: "conflict",
			})
			expect(saveContent).not.toHaveBeenCalled()
		},
	)

	it("uses the matching error even if another file succeeded", async () => {
		const mutation = client()
		const snapshot = await mutation.read("slide-1")
		saveContent.mockResolvedValue({
			...success("other"),
			error_files: [
				{
					index: 1,
					file_id: "slide-1",
					status: "error",
					error: "conflict",
					error_code: 51152,
					duration_ms: 1,
				},
			],
		})
		await expect(mutation.save(snapshot, "replacement")).rejects.toMatchObject({
			kind: "conflict",
		})
	})

	it("confirms an ambiguous network result by reading exact content without resubmission", async () => {
		const mutation = client()
		const snapshot = await mutation.read("slide-1")
		saveContent.mockImplementation(async () => {
			getInfo.mockResolvedValue(metadata(2))
			getContent.mockResolvedValue("replacement")
			throw new Error("timeout after commit")
		})
		await expect(mutation.save(snapshot, "replacement")).resolves.toEqual({ revision: 2 })
		expect(saveContent).toHaveBeenCalledTimes(1)
	})

	it("reports unknown when a timed out write cannot be confirmed", async () => {
		const mutation = client()
		const snapshot = await mutation.read("slide-1")
		saveContent.mockRejectedValue(new Error("timeout"))
		await expect(mutation.save(snapshot, "replacement")).rejects.toMatchObject({
			kind: "unknown",
		})
		expect(saveContent).toHaveBeenCalledTimes(1)
	})

	it("does not confirm a content-only write before metadata advances", async () => {
		const mutation = client()
		const snapshot = await mutation.read("slide-1")
		saveContent.mockImplementation(async () => {
			getContent.mockResolvedValue("replacement")
			throw new Error("metadata update pending")
		})
		await expect(mutation.save(snapshot, "replacement")).rejects.toMatchObject({
			kind: "unknown",
		})
		expect(saveContent).toHaveBeenCalledTimes(1)
	})

	it("does not treat another file's success as this file's success", async () => {
		const mutation = client()
		const snapshot = await mutation.read("slide-1")
		saveContent.mockResolvedValue(success("other"))
		await expect(mutation.save(snapshot, "replacement")).rejects.toMatchObject({
			kind: "unknown",
		})
	})

	it.each(["none", "share:token:project:topic"])(
		"rejects ambient metadata access for %s",
		async (identity) => {
			await expect(client(identity).read("slide-1")).rejects.toMatchObject({ kind: "stale" })
			expect(getInfo).not.toHaveBeenCalled()
		},
	)

	it("rejects snapshots from another identity-bound client", async () => {
		const snapshot = await client().read("slide-1")
		await expect(client().save(snapshot, "replacement")).rejects.toMatchObject({
			kind: "stale",
		})
		expect(saveContent).not.toHaveBeenCalled()
	})

	it("cancels reads before further requests", async () => {
		const controller = new AbortController()
		getInfo.mockImplementation(async () => {
			controller.abort()
			return metadata()
		})
		await expect(client().read("slide-1", controller.signal)).rejects.toMatchObject({
			name: "AbortError",
		})
		expect(getContent).not.toHaveBeenCalled()
	})

	it("settles a submitted save after navigation and prevents a queued write", async () => {
		const mutation = client()
		const snapshot = await mutation.read("slide-1")
		let complete: (value: ReturnType<typeof success>) => void = () => undefined
		saveContent.mockImplementation(
			() =>
				new Promise((resolve) => {
					complete = resolve
				}),
		)
		const first = mutation.save(snapshot, "replacement")
		const second = mutation.save(snapshot, "another replacement")
		const secondResult = expect(second).rejects.toMatchObject({ kind: "stale" })
		await vi.waitFor(() => expect(saveContent).toHaveBeenCalledTimes(1))
		isCurrent.mockReturnValue(false)
		complete(success())
		await expect(first).resolves.toEqual({ revision: 2 })
		await secondResult
		expect(saveContent).toHaveBeenCalledTimes(1)
	})

	it("does not read through a changed identity after an ambiguous save", async () => {
		const mutation = client()
		const snapshot = await mutation.read("slide-1")
		saveContent.mockImplementation(async () => {
			isCurrent.mockReturnValue(false)
			throw new Error("timeout")
		})
		await expect(mutation.save(snapshot, "replacement")).rejects.toMatchObject({
			kind: "unknown",
		})
		expect(getInfo).toHaveBeenCalledTimes(4)
	})

	it("initializes a new empty node without attempting to download missing content", async () => {
		const file = metadata()
		file.file.size = 0
		getInfo.mockResolvedValue(file)
		await expect(client().initializeCreatedFile("slide-1", "new content")).resolves.toEqual({
			revision: 2,
		})
		expect(getContent).not.toHaveBeenCalled()
		expect(saveContent).toHaveBeenCalledWith([
			{ file_id: "slide-1", content: "new content", expected_revision: 1 },
		])
	})

	it("refuses to initialize an existing populated node", async () => {
		await expect(
			client().initializeCreatedFile("slide-1", "new content"),
		).rejects.toMatchObject({ kind: "conflict" })
		expect(saveContent).not.toHaveBeenCalled()
	})
})
