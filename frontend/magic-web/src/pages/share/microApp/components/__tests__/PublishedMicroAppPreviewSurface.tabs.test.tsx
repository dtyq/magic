import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PublishedMicroAppPreviewSurface from "../PublishedMicroAppPreviewSurface"
import { useMicroAppPreviewFiles } from "@/pages/superMagic/pages/MicroAppPage/hooks/useMicroAppPreviewFiles"
import type { UsePublishedMicroAppPreviewReturn } from "../../hooks/usePublishedMicroAppPreview"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/pages/share/components", () => ({
	ErrorDisplay: () => null,
	PasswordVerification: () => null,
	ShareEmptyState: () => null,
}))
vi.mock("../MicroAppSafetyNotice", () => ({ default: () => null }))
vi.mock("@/pages/superMagic/components/MicroAppStateIllustration", () => ({
	MicroAppPermissionIllustration: () => null,
}))
vi.mock("@/pages/superMagic/components/MicroAppSkillsPanel", () => ({
	default: () => <button type="button">skills-trigger</button>,
}))
vi.mock("../PublishedMicroAppConversationProvider", () => ({
	default: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/pages/superMagic/fileAccess/FileAccessProvider", () => ({
	FileAccessProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/pages/superMagic/components/Detail/contents/HTML", () => ({
	default: ({
		data,
		openFileTab,
	}: {
		data: { file_id: string; htmlNavigation?: { search: string } }
		openFileTab: (file: unknown) => void
	}) => (
		<div>
			<span>
				{data.file_id}
				{data.htmlNavigation?.search}
			</span>
			<button
				onClick={() =>
					openFileTab({
						file_id: "detail",
						htmlNavigation: {
							filePath: "detail.html",
							search: "?id=42",
							hash: "#view",
							anchor: "view",
							target: "_blank",
						},
					})
				}
			>
				Open detail
			</button>
		</div>
	),
}))
const home = { file_id: "home", file_name: "index.html" }
const detail = { file_id: "detail", file_name: "detail.html" }
const files = [home, detail]
function PublishedApp({
	attachmentList = files,
	testIdPrefix = "micro-app-share",
}: {
	attachmentList?: typeof files
	testIdPrefix?: "micro-app-share" | "micro-app-tab"
} = {}) {
	const browser = useMicroAppPreviewFiles({ attachmentList: files, defaultEntryFile: home })
	const preview = {
		browser,
		previewFile: browser.previewEntryFile,
		defaultEntryFile: home,
		appId: "app",
		attachmentList,
		attachmentsTree: files,
		shareData: {},
		shareMeta: { projectId: "project", temporaryToken: "test-token" },
		hasConfirmedSafetyNotice: true,
		installFlow: {},
		previewMode: "desktop",
	} as unknown as UsePublishedMicroAppPreviewReturn
	return <PublishedMicroAppPreviewSurface preview={preview} testIdPrefix={testIdPrefix} />
}
describe("published MicroApp tabs", () => {
	it("starts with only home, carries query into the new page and returns to a barless home on close", () => {
		render(<PublishedApp />)
		expect(screen.getByText("home")).toBeVisible()
		expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
		expect(screen.queryByText("detail")).not.toBeInTheDocument()
		fireEvent.click(screen.getByText("Open detail"))
		expect(screen.getAllByRole("tab")).toHaveLength(2)
		expect(screen.getByText("detail?id=42")).toBeVisible()
		expect(screen.getByText("home")).not.toBeVisible()
		fireEvent.click(
			screen.getAllByRole("button", { name: "microAppPage.previewToolbar.closePage" })[1],
		)
		expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
		expect(screen.getByText("home")).toBeVisible()
	})

	it("hides the skills toolbar in the tab view when the project has no skill files", () => {
		const { rerender } = render(<PublishedApp testIdPrefix="micro-app-tab" />)
		expect(screen.queryByText("skills-trigger")).not.toBeInTheDocument()
		rerender(
			<PublishedApp
				testIdPrefix="micro-app-tab"
				attachmentList={[
					...files,
					{
						file_id: "skill",
						file_name: "SKILL.md",
						relative_file_path: ".magic/skills/demo/SKILL.md",
					},
				]}
			/>,
		)
		expect(screen.getByText("skills-trigger")).toBeVisible()
	})
})
