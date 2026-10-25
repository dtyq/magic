import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { useMicroAppPreviewFiles } from "../useMicroAppPreviewFiles"

function file(fileId: string, fileName: string, updatedAt?: string): AttachmentItem {
	return {
		file_id: fileId,
		file_name: fileName,
		relative_file_path: fileName,
		updated_at: updatedAt,
	}
}

describe("useMicroAppPreviewFiles", () => {
	it("keeps the selected file when refreshed items have the same id and update time", async () => {
		const defaultEntry = file("entry-1", "index.html")
		const selectedEntry = file("admin-1", "admin.html")
		const { result, rerender } = renderHook(
			({ attachmentList, defaultEntryFile }) =>
				useMicroAppPreviewFiles({ attachmentList, defaultEntryFile }),
			{
				initialProps: {
					attachmentList: [defaultEntry, selectedEntry],
					defaultEntryFile: defaultEntry,
				},
			},
		)

		act(() => result.current.handlePreviewFileChange("admin-1"))
		expect(result.current.previewEntryFile).toBe(selectedEntry)

		rerender({
			attachmentList: [file("entry-1", "index.html"), file("admin-1", "admin.html")],
			defaultEntryFile: file("entry-1", "index.html"),
		})

		await waitFor(() => expect(result.current.previewEntryFile).toBe(selectedEntry))
	})

	it("replaces the selected file when its update time changes", async () => {
		const defaultEntry = file("entry-1", "index.html")
		const selectedEntry = file("admin-1", "admin.html", "2026-08-03T05:30:00Z")
		const updatedEntry = file("admin-1", "admin.html", "2026-08-03T05:31:00Z")
		const { result, rerender } = renderHook(
			({ attachmentList }) =>
				useMicroAppPreviewFiles({ attachmentList, defaultEntryFile: defaultEntry }),
			{ initialProps: { attachmentList: [defaultEntry, selectedEntry] } },
		)

		act(() => result.current.handlePreviewFileChange("admin-1"))
		rerender({ attachmentList: [defaultEntry, updatedEntry] })

		await waitFor(() => expect(result.current.previewEntryFile).toBe(updatedEntry))
	})

	it("falls back to the default entry when the selected file is removed", async () => {
		const defaultEntry = file("entry-1", "index.html")
		const selectedEntry = file("admin-1", "admin.html")
		const { result, rerender } = renderHook(
			({ attachmentList }) =>
				useMicroAppPreviewFiles({ attachmentList, defaultEntryFile: defaultEntry }),
			{ initialProps: { attachmentList: [defaultEntry, selectedEntry] } },
		)

		act(() => result.current.handlePreviewFileChange("admin-1"))
		rerender({ attachmentList: [defaultEntry] })

		await waitFor(() => expect(result.current.previewEntryFile).toBe(defaultEntry))
	})

	it("keeps and clears HTML navigation context when opening a preview file", () => {
		const defaultEntry = file("entry-1", "index.html")
		const targetFile = file("page-1", "page1.html")
		const { result } = renderHook(() =>
			useMicroAppPreviewFiles({
				attachmentList: [defaultEntry, targetFile],
				defaultEntryFile: defaultEntry,
			}),
		)
		const navigation = {
			filePath: "page1.html",
			search: "?value=123",
			hash: "#details",
			anchor: "details",
		}
		const updatedNavigation = {
			...navigation,
			search: "?value=456",
		}

		act(() => {
			result.current.handlePreviewOpenFile({ ...targetFile, htmlNavigation: navigation })
		})
		expect(result.current.previewEntryFile).toEqual({
			...targetFile,
			htmlNavigation: navigation,
		})

		act(() => {
			result.current.handlePreviewOpenFile({
				...targetFile,
				htmlNavigation: updatedNavigation,
			})
		})
		expect(result.current.previewEntryFile).toEqual({
			...targetFile,
			htmlNavigation: updatedNavigation,
		})

		act(() => {
			result.current.handlePreviewOpenFile(targetFile)
		})
		expect(result.current.previewEntryFile).toEqual(targetFile)
		expect(result.current.previewEntryFile?.htmlNavigation).toBeUndefined()
	})
})

describe("preview browsing contexts", () => {
	const home = file("home", "index.html")
	const detail = file("detail", "detail.html")
	const third = file("third", "third.html")
	const attachmentList = [home, detail, third]
	const open = (target: string, extra = {}) => ({
		...detail,
		htmlNavigation: {
			filePath: "detail.html",
			search: "?id=42",
			hash: "#view",
			anchor: "view",
			target,
			...extra,
		},
	})
	const setup = () =>
		renderHook(() => useMicroAppPreviewFiles({ attachmentList, defaultEntryFile: home }))

	it("initializes only the home document and replaces _self without adding tabs", () => {
		const { result } = setup()
		expect(result.current.previewTabs).toHaveLength(1)
		const id = result.current.activePreviewTabId
		act(() => result.current.handlePreviewOpenFile(open("_self")))
		expect(result.current.previewTabs).toHaveLength(1)
		expect(result.current.activePreviewTabId).toBe(id)
		expect(result.current.previewEntryFile?.htmlNavigation?.search).toBe("?id=42")
	})
	it("creates separate _blank contexts for the same URL and reuses a named context", () => {
		const { result } = setup()
		act(() => {
			result.current.handlePreviewOpenFile(open("_blank"))
			result.current.handlePreviewOpenFile(open("_blank"))
		})
		expect(result.current.previewTabs).toHaveLength(3)
		expect(new Set(result.current.previewTabs.map((tab) => tab.id)).size).toBe(3)
		act(() => result.current.handlePreviewOpenFile(open("report")))
		const id = result.current.activePreviewTabId
		act(() =>
			result.current.handlePreviewOpenFile({
				...third,
				htmlNavigation: { ...open("report").htmlNavigation, filePath: "third.html" },
			}),
		)
		expect(result.current.previewTabs).toHaveLength(4)
		expect(result.current.activePreviewTabId).toBe(id)
		expect(result.current.previewEntryFile?.file_id).toBe("third")
	})
	it("keeps background opens inactive and routes delayed navigation to its source tab", () => {
		const { result } = setup()
		const homeId = result.current.activePreviewTabId
		act(() =>
			result.current.handlePreviewOpenFile(open("_blank", { background: true }), homeId),
		)
		expect(result.current.activePreviewTabId).toBe(homeId)
		const backgroundId = result.current.previewTabs[1].id
		act(() => result.current.handlePreviewOpenFile(third, backgroundId))
		expect(result.current.activePreviewTabId).toBe(homeId)
		expect(result.current.previewTabs[1].file.file_id).toBe("third")
		act(() => result.current.handlePreviewTabClose(backgroundId))
		act(() => result.current.handlePreviewOpenFile(open("_blank"), backgroundId))
		expect(result.current.previewTabs).toHaveLength(1)
	})
	it("refreshes only the active context and preserves siblings when closing it", () => {
		const { result } = setup()
		const initial = result.current.previewTabs[0]
		act(() => result.current.handlePreviewOpenFile(open("_blank")))
		const newId = result.current.activePreviewTabId
		act(() => result.current.handlePreviewRefresh())
		expect(result.current.previewTabs[0]).toBe(initial)
		expect(result.current.previewTabs[1].revision).toBe(1)
		act(() => result.current.handlePreviewTabClose(newId))
		expect(result.current.activePreviewTabId).toBe(initial.id)
		act(() => result.current.handlePreviewTabClose(initial.id))
		expect(result.current.previewTabs).toHaveLength(1)
	})
	it("keeps query and hash when attachment metadata changes", () => {
		const { result, rerender } = renderHook(
			({ files }) =>
				useMicroAppPreviewFiles({ attachmentList: files, defaultEntryFile: home }),
			{ initialProps: { files: attachmentList } },
		)
		act(() => result.current.handlePreviewOpenFile(open("_self")))
		rerender({ files: [home, { ...detail, updated_at: "new" }, third] })
		expect(result.current.previewEntryFile?.updated_at).toBe("new")
		expect(result.current.previewEntryFile?.htmlNavigation).toEqual(
			open("_self").htmlNavigation,
		)
	})
	it("resets browsing contexts on an app change and ignores files outside the current attachment scope", () => {
		const { result, rerender } = renderHook(
			({ scope }) =>
				useMicroAppPreviewFiles({
					attachmentList,
					defaultEntryFile: home,
					scopeKey: scope,
				}),
			{ initialProps: { scope: "app-one" } },
		)
		act(() => result.current.handlePreviewOpenFile(open("_blank")))
		rerender({ scope: "app-two" })
		expect(result.current.previewTabs).toHaveLength(1)
		expect(result.current.previewEntryFile?.file_id).toBe("home")
		act(() => result.current.handlePreviewOpenFile(file("unknown", "secret.html")))
		expect(result.current.previewEntryFile?.file_id).toBe("home")
	})
	it("lets editors close every page without reopening on refresh, then explicitly open any HTML", () => {
		const { result, rerender } = renderHook(
			({ files }) =>
				useMicroAppPreviewFiles({
					attachmentList: files,
					defaultEntryFile: home,
					allowCloseLastTab: true,
				}),
			{ initialProps: { files: attachmentList } },
		)
		act(() => result.current.handlePreviewTabClose(result.current.activePreviewTabId))
		expect(result.current.previewTabs).toHaveLength(0)
		rerender({ files: [...attachmentList] })
		expect(result.current.previewTabs).toHaveLength(0)
		act(() => result.current.handlePreviewAddFile("third"))
		expect(result.current.previewTabs).toHaveLength(1)
		expect(result.current.previewEntryFile?.file_id).toBe("third")
		act(() => result.current.handlePreviewAddFile("detail"))
		expect(result.current.previewTabs).toHaveLength(2)
	})
})
