import type { ReactNode } from "react"
import { act, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import MicroAppEntryPreview from "../MicroAppEntryPreview"
import MicroAppMobileEntryPreview from "../MicroAppMobileEntryPreview"

const htmlPreviewMocks = vi.hoisted(() => ({
	props: null as Record<string, unknown> | null,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML", () => ({
	default: (props: Record<string, unknown>) => {
		htmlPreviewMocks.props = props
		return <div data-testid="mobile-entry-html-preview" />
	},
}))

vi.mock("../MicroAppPhonePreviewFrame", () => ({
	default: ({ children }: { children: ReactNode }) => (
		<div data-testid="micro-app-phone-preview-frame">{children}</div>
	),
}))

describe("MicroAppMobileEntryPreview", () => {
	beforeEach(() => {
		htmlPreviewMocks.props = null
	})

	it("renders the entry html directly without file viewer chrome", async () => {
		render(
			<MicroAppMobileEntryPreview
				entryFile={{
					file_id: "entry-1",
					file_name: "index.html",
					updated_at: "2026-07-20T06:00:00Z",
				}}
				attachments={[]}
				attachmentList={[
					{
						file_id: "entry-1",
						file_name: "index.html",
						relative_file_path: "index.html",
						updated_at: "2026-07-20T06:00:00Z",
					},
				]}
				projectId="project-1"
				microAppId="app-1"
				microAppName="App One"
				selectedProject={null}
				allowEdit
			/>,
		)

		expect(await screen.findByTestId("mobile-entry-html-preview")).toBeInTheDocument()
		expect(htmlPreviewMocks.props).toEqual(
			expect.objectContaining({
				activeFileId: "entry-1",
				projectId: "project-1",
				microAppId: "app-1",
				microAppName: "App One",
				virtualStorageMarkerId: "entry-1",
				updatedAt: "2026-07-20T06:00:00Z",
				allowEdit: true,
				showFileHeader: false,
				showFooter: false,
				viewMode: "desktop",
				openFileTab: expect.any(Function),
				data: expect.objectContaining({
					file_id: "entry-1",
					file_name: "index.html",
					file_extension: "html",
				}),
			}),
		)
	})

	it("shows the existing empty state when no entry html exists", () => {
		render(
			<MicroAppMobileEntryPreview
				entryFile={null}
				attachments={[]}
				attachmentList={[]}
				selectedProject={null}
				allowEdit={false}
			/>,
		)

		expect(screen.getByTestId("micro-app-mobile-preview-empty")).toHaveTextContent(
			"microAppPage.preview.emptyTitle",
		)
	})

	it("shows the building animation when a topic is running without html", () => {
		render(
			<MicroAppMobileEntryPreview
				entryFile={null}
				attachments={[]}
				attachmentList={[]}
				selectedProject={null}
				allowEdit={false}
				isBuilding
			/>,
		)

		expect(screen.getByTestId("micro-app-mobile-preview-building")).toHaveTextContent(
			"microAppPage.preview.buildingTitle",
		)
		expect(screen.queryByTestId("micro-app-mobile-preview-empty")).not.toBeInTheDocument()
	})

	it("keeps the entry-empty state when a nested html already exists", () => {
		render(
			<MicroAppMobileEntryPreview
				entryFile={null}
				attachments={[]}
				attachmentList={[
					{
						file_id: "nested-html",
						file_name: "page.html",
						relative_file_path: "pages/page.html",
					},
				]}
				selectedProject={null}
				allowEdit={false}
				isBuilding
			/>,
		)

		expect(screen.getByTestId("micro-app-mobile-preview-empty")).toBeInTheDocument()
		expect(screen.queryByTestId("micro-app-mobile-preview-building")).not.toBeInTheDocument()
	})

	it("wraps phone preview with the shared phone frame", async () => {
		const onRegisterDevConsoleToggle = vi.fn()
		const onDevConsoleActiveChange = vi.fn()
		render(
			<MicroAppEntryPreview
				entryFile={{ file_id: "entry-1", file_name: "index.html" }}
				attachments={[]}
				attachmentList={[]}
				selectedProject={null}
				allowEdit
				viewMode="phone"
				onRegisterDevConsoleToggle={onRegisterDevConsoleToggle}
				onDevConsoleActiveChange={onDevConsoleActiveChange}
			/>,
		)

		expect(await screen.findByTestId("micro-app-phone-preview-frame")).toBeInTheDocument()
		expect(htmlPreviewMocks.props).toEqual(
			expect.objectContaining({
				viewMode: "desktop",
				onRegisterDevConsoleToggle,
				onDevConsoleActiveChange,
			}),
		)
	})
})

it.each([true, false])(
	"uses preview tabs for iframe navigation (allowEdit=%s)",
	async (allowEdit) => {
		const entry = { file_id: "home", file_name: "index.html", relative_file_path: "index.html" }
		const detail = {
			file_id: "detail",
			file_name: "detail.html",
			relative_file_path: "detail.html",
		}
		render(
			<MicroAppMobileEntryPreview
				entryFile={entry}
				attachments={[]}
				attachmentList={[entry, detail]}
				selectedProject={null}
				allowEdit={allowEdit}
				microAppId="app"
			/>,
		)
		await screen.findByTestId("mobile-entry-html-preview")
		const navigate = htmlPreviewMocks.props?.openFileTab as (file: unknown) => void
		act(() =>
			navigate({
				...detail,
				htmlNavigation: {
					filePath: "detail.html",
					search: "?id=7",
					hash: "",
					anchor: "",
					target: "_blank",
				},
			}),
		)
		expect(screen.getAllByRole("tab")).toHaveLength(2)
		expect(htmlPreviewMocks.props?.activeFileId).toBe("detail")
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		// The original iframe remains mounted when its child browsing context opens.
		expect(screen.getAllByTestId("mobile-entry-html-preview")).toHaveLength(2)
		const navigateCurrent = htmlPreviewMocks.props?.openFileTab as (file: unknown) => void
		act(() =>
			navigateCurrent({
				...entry,
				htmlNavigation: {
					filePath: "index.html",
					search: "",
					hash: "",
					anchor: "",
					target: "_self",
				},
			}),
		)
		expect(screen.getAllByRole("tab")).toHaveLength(2)
		expect(htmlPreviewMocks.props?.activeFileId).toBe("home")
	},
)

it.each([true, false])("only shows the add-page action in development (enabled=%s)", (enabled) => {
	render(
		<MicroAppMobileEntryPreview
			entryFile={null}
			attachments={[]}
			attachmentList={[]}
			selectedProject={null}
			allowEdit={false}
			showOpenPageMenu={enabled}
		/>,
	)
	const button = screen.queryByRole("button", { name: "microAppPage.previewToolbar.openPage" })
	if (enabled) expect(button).toBeDisabled()
	else expect(button).not.toBeInTheDocument()
})
