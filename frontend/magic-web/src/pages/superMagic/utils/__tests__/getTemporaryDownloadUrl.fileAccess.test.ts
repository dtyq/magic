import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { defaultMagicClient as magicClient } from "@/infrastructure/network/http/runtime"
import { createSessionFileAccess, createShareFileAccess } from "../../fileAccess/fileAccessContext"
import { getFileContentsByIds, getTemporaryDownloadUrl } from "../api"

vi.mock("@/infrastructure/network/http/runtime", () => ({ defaultMagicClient: { post: vi.fn() } }))

vi.mock("@/models/user", () => ({
	userStore: { user: { userInfo: { user_id: "user-1" } } },
}))

vi.mock("../superMagicCache", () => ({
	WorkspaceStateCache: {
		get: () => ({ projectId: "workspace-project", topicId: "workspace-topic" }),
	},
}))

vi.mock("../query", () => ({
	getSuperIdState: () => ({}),
}))

describe("getTemporaryDownloadUrl file access", () => {
	beforeEach(() => {
		vi.mocked(magicClient.post).mockReset()
		vi.mocked(magicClient.post).mockResolvedValue([])
		;(window as Window & { temporary_token?: string }).temporary_token = "stale-share-token"
		;(window as Window & { project_id?: string }).project_id = "stale-share-project"
	})

	afterEach(() => {
		delete (window as Window & { temporary_token?: string }).temporary_token
		delete (window as Window & { project_id?: string }).project_id
	})

	it("does not inherit window share identity when access is omitted", async () => {
		await getTemporaryDownloadUrl({ file_ids: ["file-1"] })

		expect(magicClient.post).toHaveBeenCalledWith(
			"/api/v1/super-agent/tasks/get-file-url",
			expect.objectContaining({
				file_ids: ["file-1"],
				token: "",
				project_id: "workspace-project",
				topic_id: "workspace-topic",
			}),
			expect.any(Object),
		)
	})

	it("allows an explicit runtime session on a share route", async () => {
		const originalPath = window.location.pathname
		window.history.replaceState(null, "", "/share/files/share-1")
		try {
			await getTemporaryDownloadUrl({
				file_ids: ["runtime-file"],
				access: createSessionFileAccess({
					projectId: "runtime-project",
					topicId: "runtime-topic",
				}),
			})
		} finally {
			window.history.replaceState(null, "", originalPath)
		}
		expect(magicClient.post).toHaveBeenCalledWith(
			"/api/v1/super-agent/tasks/get-file-url",
			expect.objectContaining({
				project_id: "runtime-project",
				topic_id: "runtime-topic",
				token: "",
			}),
			expect.any(Object),
		)
	})

	it("sends the explicit share access token and project", async () => {
		await getTemporaryDownloadUrl({
			file_ids: ["file-1"],
			access: createShareFileAccess({
				token: "share-token",
				projectId: "origin-project",
				topicId: "share-topic",
			}),
		})

		expect(magicClient.post).toHaveBeenCalledWith(
			"/api/v1/super-agent/tasks/get-file-url",
			expect.objectContaining({
				token: "share-token",
				project_id: "origin-project",
				topic_id: "share-topic",
			}),
			expect.any(Object),
		)
	})

	it("keeps session identity on host micro-app pages when access is omitted", async () => {
		const originalPath = window.location.pathname
		window.history.replaceState(null, "", "/global/super/micro-app/9575893229010228865")

		try {
			await getTemporaryDownloadUrl({ file_ids: ["file-1"] })
		} finally {
			window.history.replaceState(null, "", originalPath)
		}

		expect(magicClient.post).toHaveBeenCalledWith(
			"/api/v1/super-agent/tasks/get-file-url",
			expect.objectContaining({
				file_ids: ["file-1"],
				token: "",
				project_id: "workspace-project",
				topic_id: "workspace-topic",
			}),
			expect.any(Object),
		)
	})

	it("does not inherit session identity on share pages when access is omitted", async () => {
		const originalPath = window.location.pathname
		window.history.replaceState(null, "", "/share/files/share-1")

		try {
			await expect(getTemporaryDownloadUrl({ file_ids: ["file-1"] })).resolves.toEqual([])
		} finally {
			window.history.replaceState(null, "", originalPath)
		}

		expect(magicClient.post).not.toHaveBeenCalled()
	})

	it("sends an empty topic id for share access without a topic", async () => {
		await getTemporaryDownloadUrl({
			file_ids: ["file-1"],
			access: createShareFileAccess({
				token: "share-token",
				projectId: "origin-project",
			}),
		})

		expect(magicClient.post).toHaveBeenCalledWith(
			"/api/v1/super-agent/tasks/get-file-url",
			expect.objectContaining({
				token: "share-token",
				project_id: "origin-project",
				topic_id: "",
			}),
			expect.any(Object),
		)
	})

	it("forwards share access when loading file contents by id", async () => {
		vi.mocked(magicClient.post).mockResolvedValue([
			{ file_id: "file-1", url: "https://example.invalid/file-1" },
		])
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				text: async () => "file-content",
			}),
		)

		await getFileContentsByIds(["file-1"], {
			responseType: "text",
			access: createShareFileAccess({
				token: "share-token",
				projectId: "origin-project",
			}),
		})

		expect(magicClient.post).toHaveBeenCalledWith(
			"/api/v1/super-agent/tasks/get-file-url",
			expect.objectContaining({
				token: "share-token",
				project_id: "origin-project",
				topic_id: "",
			}),
			expect.any(Object),
		)

		vi.unstubAllGlobals()
	})
})
