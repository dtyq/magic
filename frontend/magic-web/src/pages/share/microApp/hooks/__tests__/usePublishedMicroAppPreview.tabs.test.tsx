import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { usePublishedMicroAppPreview } from "../usePublishedMicroAppPreview"

const data = vi.hoisted(() => ({
	shareData: { default_open_file_id: "landing" },
	shareMeta: { projectId: "project", projectName: "App" },
	attachmentList: [
		{ file_id: "index", file_name: "index.html", relative_file_path: "index.html" },
		{ file_id: "landing", file_name: "welcome.html", relative_file_path: "welcome.html" },
	],
	resourceId: "share",
}))
vi.mock("../useMicroAppShareData", () => ({ default: () => data }))
vi.mock("../useMicroAppInstallFlow", () => ({
	default: () => ({ rememberVerifiedPassword: vi.fn() }),
}))
vi.mock("../useMicroAppSafetyNoticeConfirmation", () => ({
	default: () => ({ hasConfirmedSafetyNotice: true, confirmSafetyNotice: vi.fn() }),
}))

describe("published preview initialization", () => {
	it("opens only the configured homepage and enforces the final-page rule", () => {
		const { result, rerender } = renderHook(
			({ appId }) => usePublishedMicroAppPreview({ appId }),
			{ initialProps: { appId: "first" } },
		)
		expect(result.current.browser.previewTabs).toHaveLength(1)
		expect(result.current.previewFile?.file_id).toBe("landing")
		act(() =>
			result.current.browser.handlePreviewTabClose(result.current.browser.activePreviewTabId),
		)
		expect(result.current.browser.previewTabs).toHaveLength(1)
		act(() =>
			result.current.handleOpenFileTab({
				...data.attachmentList[0],
				htmlNavigation: {
					filePath: "index.html",
					search: "?item=1",
					hash: "#view",
					anchor: "view",
					target: "_blank",
				},
			}),
		)
		expect(result.current.browser.previewTabs).toHaveLength(2)
		expect(result.current.previewFile?.htmlNavigation?.search).toBe("?item=1")
		rerender({ appId: "second" })
		expect(result.current.browser.previewTabs).toHaveLength(1)
		expect(result.current.previewFile?.file_id).toBe("landing")
	})
})
