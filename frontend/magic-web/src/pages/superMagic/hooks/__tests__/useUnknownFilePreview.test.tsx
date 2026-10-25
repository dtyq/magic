import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FileAccessProvider } from "../../fileAccess/FileAccessProvider"
import type { FileAccessContext } from "../../fileAccess/fileAccessContext"
import { useUnknownFilePreview } from "../useUnknownFilePreview"

const mocks = vi.hoisted(() => ({
	getTemporaryDownloadUrl: vi.fn(),
	fetchBoundedBlob: vi.fn(),
}))

vi.mock("react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-router")>()),
	useLocation: () => ({ pathname: "/workspace" }),
}))
vi.mock("../../utils/api", () => ({
	getTemporaryDownloadUrl: mocks.getTemporaryDownloadUrl,
	getFileContentById: vi.fn(),
	getFileContentsByIds: vi.fn(),
}))
vi.mock("../../services/sharedMediaUrlCache", () => ({ requestSharedMediaUrls: vi.fn() }))
vi.mock("../../services/sharedMediaResourceScope", () => ({
	getSharedMediaResourceScope: () => "host-user",
	useSharedMediaResourceScope: () => "host-user",
}))
vi.mock("@/utils/fetch-bounded-blob", () => ({ fetchBoundedBlob: mocks.fetchBoundedBlob }))
vi.mock("../../utils/handleFIle", () => ({ getFileType: () => "notSupport" }))
vi.mock("../../stores/fileIconStore", () => ({
	fileIconStore: { invalidateContentKind: vi.fn(), setContentKind: vi.fn() },
}))

describe("useUnknownFilePreview access identity", () => {
	let access: FileAccessContext
	const file = { file_id: "file-1", file_name: "data.unknown", file_extension: "unknown" }
	function Wrapper({ children }: { children: ReactNode }) {
		return <FileAccessProvider value={access}>{children}</FileAccessProvider>
	}

	beforeEach(() => {
		vi.clearAllMocks()
		access = { kind: "share", token: "first-token", projectId: "shared-project" }
		mocks.fetchBoundedBlob.mockResolvedValue({ status: "too-large" })
	})

	it("binds unknown file URL requests to the preview share access", async () => {
		mocks.getTemporaryDownloadUrl.mockResolvedValue([{ file_id: "file-1", url: "first-url" }])
		const { result } = renderHook(() => useUnknownFilePreview(file, true), { wrapper: Wrapper })
		await waitFor(() => expect(result.current.state.status).toBe("too-large"))
		expect(mocks.getTemporaryDownloadUrl).toHaveBeenCalledWith(
			expect.objectContaining({ access }),
		)
	})

	it("restarts on token rotation and discards the previous URL response", async () => {
		let resolvePrevious!: (value: Array<{ file_id: string; url: string }>) => void
		mocks.getTemporaryDownloadUrl
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						resolvePrevious = resolve
					}),
			)
			.mockResolvedValueOnce([{ file_id: "file-1", url: "new-url" }])
		const { result, rerender } = renderHook(() => useUnknownFilePreview(file, true), {
			wrapper: Wrapper,
		})
		await waitFor(() => expect(mocks.getTemporaryDownloadUrl).toHaveBeenCalledTimes(1))
		access = { kind: "share", token: "new-token", projectId: "shared-project" }
		rerender()
		await waitFor(() => expect(result.current.state.status).toBe("too-large"))
		await act(async () => resolvePrevious([{ file_id: "file-1", url: "old-url" }]))
		expect(mocks.getTemporaryDownloadUrl).toHaveBeenLastCalledWith(
			expect.objectContaining({ access }),
		)
		expect(mocks.fetchBoundedBlob).toHaveBeenCalledTimes(1)
		expect(mocks.fetchBoundedBlob).toHaveBeenCalledWith("new-url", expect.any(Object))
	})
})
