import { createElement, type ReactNode } from "react"
import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FileAccessProvider } from "../FileAccessProvider"
import { createSessionFileAccess, createShareFileAccess } from "../fileAccessContext"
import {
	getFileContentById,
	getFileContentsByIds,
	getTemporaryDownloadUrl,
} from "@/pages/superMagic/utils/api"
import { requestSharedMediaUrls } from "@/pages/superMagic/services/sharedMediaUrlCache"
import { createFileApi, useFileApi } from "../fileApi"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: vi.fn(),
	getFileContentById: vi.fn(),
	getFileContentsByIds: vi.fn(),
}))

vi.mock("@/pages/superMagic/services/sharedMediaUrlCache", () => ({
	requestSharedMediaUrls: vi.fn(),
}))

const getTemporaryDownloadUrlMock = vi.mocked(getTemporaryDownloadUrl)
const getFileContentByIdMock = vi.mocked(getFileContentById)
const getFileContentsByIdsMock = vi.mocked(getFileContentsByIds)
const requestSharedMediaUrlsMock = vi.mocked(requestSharedMediaUrls)

describe("createFileApi", () => {
	beforeEach(() => {
		getTemporaryDownloadUrlMock.mockReset()
		getFileContentByIdMock.mockReset()
		getFileContentsByIdsMock.mockReset()
		requestSharedMediaUrlsMock.mockReset()
	})

	it("forwards a bound share access on every leaf call", async () => {
		const shareAccess = createShareFileAccess({
			token: "share-token",
			projectId: "origin-project",
			topicId: "share-topic",
		})
		const fileApi = createFileApi(shareAccess)
		expect(fileApi.identityKey).toContain("share:share-token:origin-project")

		await fileApi.getTemporaryDownloadUrl({ file_ids: ["file-1"] })
		await fileApi.getFileContentById("file-2")
		await fileApi.getFileContentsByIds(["file-3"])
		await fileApi.requestSharedMediaUrls(["file-4"])

		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledWith({
			file_ids: ["file-1"],
			access: shareAccess,
		})
		expect(getFileContentByIdMock).toHaveBeenCalledWith("file-2", { access: shareAccess })
		expect(getFileContentsByIdsMock).toHaveBeenCalledWith(["file-3"], { access: shareAccess })
		expect(requestSharedMediaUrlsMock).toHaveBeenCalledWith(["file-4"], {
			access: shareAccess,
			identityKey: fileApi.identityKey,
		})
	})

	it("lets an explicit per-call access override the bound access", async () => {
		const bound = createShareFileAccess({
			token: "bound-token",
			projectId: "bound-project",
		})
		const override = createShareFileAccess({
			token: "override-token",
			projectId: "override-project",
		})
		const fileApi = createFileApi(bound)

		await fileApi.getTemporaryDownloadUrl({ file_ids: ["file-1"], access: override })
		await fileApi.getFileContentById("file-2", { access: override })
		await fileApi.requestSharedMediaUrls(["file-3"], { access: override })

		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledWith({
			file_ids: ["file-1"],
			access: override,
		})
		expect(getFileContentByIdMock).toHaveBeenCalledWith("file-2", { access: override })
		expect(requestSharedMediaUrlsMock).toHaveBeenCalledWith(["file-3"], {
			access: override,
			identityKey: expect.stringContaining("share:override-token:override-project"),
		})
	})

	it("forwards an undefined access when unbound, preserving the leaf fail-closed guard", async () => {
		const fileApi = createFileApi()
		expect(fileApi.identityKey).toBe("none")

		await fileApi.getTemporaryDownloadUrl({ file_ids: ["file-1"] })

		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledWith({
			file_ids: ["file-1"],
			access: undefined,
		})
	})

	it("does not forward a session access as a share token", async () => {
		const sessionAccess = createSessionFileAccess({ projectId: "host-project" })
		const fileApi = createFileApi(sessionAccess)

		await fileApi.getFileContentById("file-1")

		expect(getFileContentByIdMock).toHaveBeenCalledWith("file-1", { access: sessionAccess })
	})
})

describe("useFileApi", () => {
	beforeEach(() => {
		getTemporaryDownloadUrlMock.mockReset()
	})

	it("returns a share-bound FileApi from the ambient provider", () => {
		const shareAccess = createShareFileAccess({
			token: "share-token",
			projectId: "origin-project",
		})
		const { result } = renderHook(() => useFileApi(), {
			wrapper: ({ children }: { children: ReactNode }) =>
				createElement(FileAccessProvider, { value: shareAccess }, children),
		})

		void result.current.getTemporaryDownloadUrl({ file_ids: ["file-1"] })

		expect(getTemporaryDownloadUrlMock).toHaveBeenCalledWith({
			file_ids: ["file-1"],
			access: shareAccess,
		})
	})

	it("keeps the same instance across renders with an equal access identity", () => {
		let currentAccess = createShareFileAccess({
			token: "share-token",
			projectId: "origin-project",
		})
		const { result, rerender } = renderHook(() => useFileApi(), {
			wrapper: ({ children }: { children: ReactNode }) =>
				createElement(FileAccessProvider, { value: currentAccess }, children),
		})

		const firstApi = result.current

		// Rebuild an equal access object; the FileApi must not churn.
		currentAccess = createShareFileAccess({
			token: "share-token",
			projectId: "origin-project",
		})
		rerender()

		expect(result.current).toBe(firstApi)
	})

	it("replaces the instance when the share identity changes", () => {
		let currentAccess = createShareFileAccess({
			token: "share-token",
			projectId: "origin-project",
		})
		const { result, rerender } = renderHook(() => useFileApi(), {
			wrapper: ({ children }: { children: ReactNode }) =>
				createElement(FileAccessProvider, { value: currentAccess }, children),
		})

		const firstApi = result.current
		currentAccess = createShareFileAccess({
			token: "share-token",
			projectId: "another-project",
		})
		rerender()

		expect(result.current).not.toBe(firstApi)
	})
})
