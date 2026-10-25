import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import {
	findFilePathAttachment,
	openFileByPath,
} from "@/pages/superMagic/components/MessageList/utils/attachmentByFilePath"
import { AttachmentSection } from "../AttachmentSection"

const state = vi.hoisted(() => ({
	content: "",
	files: [] as AttachmentItem[],
}))

vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: { getMessageNode: () => ({ content: state.content }) },
}))
vi.mock("@/stores/projectFiles", () => ({ default: {} }))
vi.mock("@/pages/superMagic/components/MessageList/context", () => ({
	useMessageListContext: () => ({ projectFilesStore: { workspaceFilesList: state.files } }),
	/**
	 * The files a referenced path is resolved against, and the little that is needed to draw the
	 * resolved file. The section reads all three through this hook, so the stand-in carries the same
	 * shape a real store does rather than only the list these tests vary.
	 */
	useMessageListProjectFilesStore: () => ({
		workspaceFilesList: state.files,
		filePresentationContext: { kind: "project", projectId: "project-1" },
		filePresentationIndex: undefined,
	}),
}))
vi.mock("@/pages/superMagic/components/MessageList/view-state/MessageViewStateContext", () => ({
	useMessageViewState: () => [false, vi.fn()],
}))
vi.mock("@/pages/superMagic/components/MessageList/components/MessageAttachment", () => ({
	Attachment: () => <div data-testid="fallback-attachments" />,
}))
vi.mock("@/pages/superMagic/components/MessageList/utils/openMessageFile", () => ({
	openMessageFile: vi.fn(),
}))
vi.mock(
	"@/pages/superMagic/components/MessageList/components/MessageAttachment/hooks/useFilePathAttachmentDownload",
	() => ({
		useFilePathAttachmentDownload: () => vi.fn(),
	}),
)
vi.mock("@/components/base/MagicFileIcon", () => ({ default: () => null }))
vi.mock("@/components/base/MagicIcon", () => ({ default: () => null }))
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { count?: number }) => `${key}:${options?.count ?? ""}`,
	}),
	/**
	 * Not used by this component, but reached from its graph anyway: the file icon it renders pulls
	 * in the app's i18n store, and that store builds its instance at import time. Without this the
	 * whole file fails to collect before a single test runs. The sibling `MessageAttachment` test
	 * carries the same line for the same reason.
	 */
	initReactI18next: { type: "3rdParty", init: vi.fn() },
}))

/**
 * The new-user guide's entry, as the section sees it. Held in a flag rather than stubbed per test
 * because the section reads it inside the click, and because "the guide is due" is the only thing
 * about it the section knows.
 */
const guideState = vi.hoisted(() => ({ deliverableRunDue: false }))

vi.mock("@/pages/superMagic/components/LazyGuideTour/GuideTourManager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/pages/superMagic/components/LazyGuideTour/GuideTourManager")
		>()
	return {
		...actual,
		startHomeOnboardingDeliverableRunIfDue: () => guideState.deliverableRunDue,
	}
})
vi.mock(
	"@/pages/superMagic/components/MessageList/utils/attachmentByFilePath",
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import("@/pages/superMagic/components/MessageList/utils/attachmentByFilePath")
			>()
		return {
			...actual,
			findFilePathAttachment: vi.fn(actual.findFilePathAttachment),
			openFileByPath: vi.fn(),
		}
	},
)

function showAttachments(content: string, paths: string[]) {
	state.content = content
	state.files = paths.map((path, index) => ({
		file_id: String(index),
		relative_file_path: path,
	})) as AttachmentItem[]
	return render(<AttachmentSection prevSuperMessageId="previous-message" />)
}

describe("AttachmentSection file reference deduplication", () => {
	beforeEach(() => vi.clearAllMocks())

	it("prefers completed task attachments over previous-message file references", () => {
		state.content = "[Generated](./Canvas/images/generated.jpg)"
		state.files = [
			{
				file_id: "generated-file",
				relative_file_path: "Canvas/images/generated.jpg",
			},
		] as AttachmentItem[]

		render(
			<AttachmentSection
				node={{
					role: "tool",
					status: "finished",
					tool: { name: "finish_task" },
					attachments: [
						{ file_id: "generated-file", file_name: "generated.jpg" },
						{ file_id: "config", file_name: "magic.project.js" },
					],
				}}
				prevSuperMessageId="previous-message"
			/>,
		)

		expect(screen.getByTestId("fallback-attachments")).toBeInTheDocument()
		expect(screen.queryByTestId("open-file-by-path")).not.toBeInTheDocument()
	})

	it("looks up each repeated reference once and counts unique files in first-appearance order", () => {
		showAttachments(
			"[B](./docs/b.md) [A](./docs/a.md) [B again](./docs/b.md) [A again](./docs/a.md) [B third](./docs/b.md)",
			["docs/a.md", "docs/b.md"],
		)
		const rows = screen.getAllByTestId("open-file-by-path")
		expect(rows.map((row) => row.textContent)).toEqual(["b.md", "a.md"])
		expect(screen.getByTestId("toggle-expanded")).toHaveTextContent("ui.attachments:2")
		expect(screen.queryByTestId("toggle-expanded-2")).not.toBeInTheDocument()
		expect(findFilePathAttachment).toHaveBeenCalledTimes(2)
	})

	it("merges Markdown and encoded legacy references after resolving the real file path", () => {
		showAttachments(
			"[Report](./docs/my%20report.md) [@file_path:docs/my%20report.md] [@file_path:./docs/my report.md]",
			["docs/my report.md"],
		)
		const rows = screen.getAllByTestId("open-file-by-path")
		expect(rows).toHaveLength(1)
		fireEvent.click(rows[0])
		expect(openFileByPath).toHaveBeenCalledWith(
			expect.objectContaining({ filePath: "docs/my report.md" }),
		)
	})

	it("keeps same-named files in different directories", () => {
		showAttachments("[A](./one/report.md) [B](./two/report.md)", [
			"one/report.md",
			"two/report.md",
		])
		expect(screen.getAllByTestId("open-file-by-path")).toHaveLength(2)
	})

	it("does not discard a legacy reference that can resolve when the same Markdown path cannot", () => {
		showAttachments("[Literal](./docs/a%2520b.md) [@file_path:docs/a%20b.md]", ["docs/a b.md"])
		expect(screen.getAllByTestId("open-file-by-path")).toHaveLength(1)
		expect(findFilePathAttachment).toHaveBeenCalledTimes(2)
	})

	it("keeps literal percent-encoded filenames distinct from decoded filenames", () => {
		showAttachments("[Literal](./docs/a%2520b.md) [Decoded](./docs/a%20b.md)", [
			"docs/a%20b.md",
			"docs/a b.md",
		])
		expect(screen.getAllByTestId("open-file-by-path")).toHaveLength(2)
	})
})

/**
 * The one click a new account's guide is allowed to take. It is the first of these files such an
 * account ever asks for, and the guide explains what these files are — so the file stays shut while
 * it is on screen, and the user opens it by clicking again. Everything else about the click is
 * unchanged, which the group above covers.
 */
describe("the first click a new account gives one of these files", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		guideState.deliverableRunDue = false
	})

	it("spends it on the guide, opens nothing, and marks the block the guide frames", () => {
		guideState.deliverableRunDue = true
		showAttachments("[A](./docs/a.md)", ["docs/a.md"])

		fireEvent.click(screen.getAllByTestId("open-file-by-path")[0])

		expect(openFileByPath).not.toHaveBeenCalled()
		// The guide's first step has nothing else to point at: this mark is the only record of which
		// of the page's blocks the click belonged to.
		expect(
			document.querySelector('[data-guide-anchor="deliverable-attachment"]'),
		).not.toBeNull()
	})

	it("opens the file on the click after the guide", () => {
		showAttachments("[A](./docs/a.md)", ["docs/a.md"])

		fireEvent.click(screen.getAllByTestId("open-file-by-path")[0])

		expect(openFileByPath).toHaveBeenCalledWith(
			expect.objectContaining({ filePath: "docs/a.md" }),
		)
	})
})
