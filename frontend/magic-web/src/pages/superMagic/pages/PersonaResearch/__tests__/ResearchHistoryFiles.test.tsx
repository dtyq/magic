import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { store, previewOpen, filesButtonProps } = vi.hoisted(() => ({
	store: {
		selectedProject: { id: "project-1" } as { id: string } | null,
		selectedTopic: null,
		isReadOnly: false,
		attachments: [
			{ file_id: "personas", relative_file_path: "personas/", is_directory: true },
			{ file_id: "chats", relative_file_path: "template-chats/", is_directory: true },
		] as Record<string, unknown>[],
		attachmentList: [{ file_id: "list" }],
		projectFilesStore: { tag: "research-files-store" },
		personaById: vi.fn(),
		refreshAttachments: vi.fn(),
	},
	previewOpen: vi.fn(),
	filesButtonProps: { current: null as Record<string, unknown> | null },
}))

vi.mock("react-i18next", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-i18next")>()),
	useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => false }))
vi.mock("../context", () => ({ usePersonaResearchStore: () => store }))
vi.mock("@/pages/superMagic/components/TopicFilesButton", () => ({
	default: (props: Record<string, unknown>) => {
		filesButtonProps.current = props
		return <div data-testid="files-tree" />
	},
}))
vi.mock("@/pages/superMagicMobile/components/PreviewDetailPopup", async () => {
	const { forwardRef, useImperativeHandle } = await import("react")
	return {
		default: forwardRef((_props: unknown, ref) => {
			useImperativeHandle(ref, () => ({ open: previewOpen }))
			return null
		}),
	}
})
vi.mock("../components/PersonaDetailSheet", () => ({
	default: ({ persona }: { persona: { name: string } | null }) =>
		persona ? <div data-testid="persona-dialog">{persona.name}</div> : null,
}))
vi.mock("../hooks/useResearchFileDisplayResolver", () => ({
	useResearchFileDisplayResolver: () => (file: { path: string }) =>
		file.path === "studies/a/report.html" ? { name: "研究报告" } : null,
}))
vi.mock("../components/ResearchStateView", () => ({
	default: () => <div data-testid="loading" />,
}))

const { default: ResearchHistoryFiles } = await import("../components/ResearchHistoryFiles")

const onOpenChange = vi.fn()
const clickFile = (file: unknown) =>
	act(() => (filesButtonProps.current?.onFileClick as (file: unknown) => void)(file))

beforeEach(() => {
	store.selectedProject = { id: "project-1" }
	onOpenChange.mockClear()
	previewOpen.mockClear()
	store.personaById.mockReset()
})
afterEach(cleanup)

describe("ResearchHistoryFiles", () => {
	it("renders nothing while closed", () => {
		render(
			<ResearchHistoryFiles open={false} onOpenChange={onOpenChange}>
				<main data-testid="page" />
			</ResearchHistoryFiles>,
		)
		expect(screen.queryByTestId("persona-research-history-files")).toBeNull()
		expect(screen.getByTestId("page")).toBeTruthy()
	})

	it("keeps the page mounted and offers a resize handle while open", () => {
		const { rerender } = render(
			<ResearchHistoryFiles open={false} onOpenChange={onOpenChange}>
				<main data-testid="page" />
			</ResearchHistoryFiles>,
		)
		const page = screen.getByTestId("page")
		rerender(
			<ResearchHistoryFiles open onOpenChange={onOpenChange}>
				<main data-testid="page" />
			</ResearchHistoryFiles>,
		)
		expect(screen.getByTestId("page")).toBe(page)
		expect(screen.getByRole("separator", { name: "historyFiles.resize" })).toBeTruthy()
	})

	it("lists the whole research project from the research store's own file data", () => {
		render(
			<ResearchHistoryFiles open onOpenChange={onOpenChange}>
				<main data-testid="page" />
			</ResearchHistoryFiles>,
		)
		expect(screen.getByTestId("persona-research-history-files")).toBeTruthy()
		expect(filesButtonProps.current).toMatchObject({
			projectId: "project-1",
			projectFilesStore: store.projectFilesStore,
			showRefresh: true,
			selectedTopic: null,
			allowEdit: true,
			allowDownload: true,
		})
	})

	it("hides internal template-chats folders but keeps the real tree untouched", () => {
		render(
			<ResearchHistoryFiles open onOpenChange={onOpenChange}>
				<main />
			</ResearchHistoryFiles>,
		)
		const shown = filesButtonProps.current?.attachments as { file_id: string }[]
		expect(shown.map((item) => item.file_id)).toEqual(["personas"])
		expect(store.attachments).toHaveLength(2)
	})

	it("offers a refresh that re-reads the project's files", () => {
		render(
			<ResearchHistoryFiles open onOpenChange={onOpenChange}>
				<main />
			</ResearchHistoryFiles>,
		)
		;(filesButtonProps.current?.refreshAttachments as () => void)()
		expect(store.refreshAttachments).toHaveBeenCalledTimes(1)
	})

	it("shows readable names through the row decoration, leaving other files as they are", () => {
		render(
			<ResearchHistoryFiles open onOpenChange={onOpenChange}>
				<main />
			</ResearchHistoryFiles>,
		)
		const decorate = filesButtonProps.current?.resolveTopicFileRowDecoration as (c: {
			item: Record<string, unknown>
		}) => { name?: string } | null
		expect(
			decorate({
				item: { relative_file_path: "studies/a/report.html", file_name: "report.html" },
			}),
		).toMatchObject({ name: "研究报告" })
		expect(
			decorate({ item: { relative_file_path: "notes.md", file_name: "notes.md" } }),
		).toBeNull()
	})

	it("shows a loading state until the project is known", () => {
		store.selectedProject = null
		render(
			<ResearchHistoryFiles open onOpenChange={onOpenChange}>
				<main data-testid="page" />
			</ResearchHistoryFiles>,
		)
		expect(screen.getByTestId("loading")).toBeTruthy()
		expect(screen.queryByTestId("files-tree")).toBeNull()
	})

	it("previews a clicked file in the floating layer with the store's attachments", () => {
		render(
			<ResearchHistoryFiles open onOpenChange={onOpenChange}>
				<main data-testid="page" />
			</ResearchHistoryFiles>,
		)
		clickFile({
			file_id: "f1",
			file_name: "report.html",
			file_extension: "html",
			relative_file_path: "studies/a/report.html",
		})
		expect(previewOpen).toHaveBeenCalledTimes(1)
		const [detail, tree, list] = previewOpen.mock.calls[0]
		expect(detail).toMatchObject({ currentFileId: "f1" })
		expect(tree).toBe(store.attachments) // handed over by reference, not copied
		expect(list).toBe(store.attachmentList)
		expect(onOpenChange).not.toHaveBeenCalled()
	})

	it("ignores folders", () => {
		render(
			<ResearchHistoryFiles open onOpenChange={onOpenChange}>
				<main data-testid="page" />
			</ResearchHistoryFiles>,
		)
		clickFile({ file_id: "d1", file_name: "studies", is_directory: true })
		expect(previewOpen).not.toHaveBeenCalled()
	})

	it("opens a library persona in its own dialog instead of raw JSON", () => {
		store.personaById.mockReturnValue({ name: "Chen" })
		render(
			<ResearchHistoryFiles open onOpenChange={onOpenChange}>
				<main data-testid="page" />
			</ResearchHistoryFiles>,
		)
		clickFile({
			file_id: "p1",
			file_name: "p_chen.json",
			file_extension: "json",
			relative_file_path: "personas/p_chen.json",
		})
		expect(store.personaById).toHaveBeenCalledWith("p_chen")
		expect(screen.getByTestId("persona-dialog").textContent).toBe("Chen")
		expect(previewOpen).not.toHaveBeenCalled()
	})

	it("closes from the close button and with Escape", () => {
		render(
			<ResearchHistoryFiles open onOpenChange={onOpenChange}>
				<main data-testid="page" />
			</ResearchHistoryFiles>,
		)
		fireEvent.click(screen.getByRole("button", { name: "historyFiles.close" }))
		expect(onOpenChange).toHaveBeenLastCalledWith(false)
		onOpenChange.mockClear()
		fireEvent.keyDown(screen.getByTestId("files-tree"), { key: "Escape" })
		expect(onOpenChange).toHaveBeenCalledWith(false)
	})
})
