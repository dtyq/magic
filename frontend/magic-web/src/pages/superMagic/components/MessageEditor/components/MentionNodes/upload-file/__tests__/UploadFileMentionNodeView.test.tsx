import type { ComponentProps, ElementType, PropsWithChildren } from "react"
import { act, render, screen, within } from "@testing-library/react"
import { observable, runInAction } from "mobx"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import UploadFileMentionNodeView from "../UploadFileMentionNodeView"

const storeMocks = vi.hoisted(() => ({
	hasStore: true,
	getFileById: vi.fn(),
}))

vi.mock("@/infrastructure/editors/tiptap/react", () => ({
	NodeViewWrapper: ({
		as: Component = "div",
		children,
		...props
	}: PropsWithChildren<{ as?: ElementType }>) => {
		const Wrapper = Component
		return <Wrapper {...props}>{children}</Wrapper>
	},
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
	initReactI18next: { type: "3rdParty", init: vi.fn() },
}))

vi.mock("@/pages/superMagic/components/MessageEditor/stores", () => ({
	useOptionalMessageEditorStore: () =>
		storeMocks.hasStore
			? {
					fileUploadStore: {
						getFileById: storeMocks.getFileById,
					},
				}
			: null,
}))

function createProps(
	data: Record<string, unknown> = {},
): ComponentProps<typeof UploadFileMentionNodeView> {
	return {
		attrs: {
			type: MentionItemType.UPLOAD_FILE,
			data: {
				file_id: "file-1",
				file_name: "demo.mov",
				file_extension: "mov",
				file_size: 100,
				...data,
			},
		},
		selected: false,
		deleteNode: vi.fn(),
	} as unknown as ComponentProps<typeof UploadFileMentionNodeView>
}

describe("UploadFileMentionNodeView", () => {
	beforeEach(() => {
		storeMocks.hasStore = true
		storeMocks.getFileById.mockReset()
	})

	it("renders live upload progress from the editor-scoped store", () => {
		storeMocks.getFileById.mockReturnValue({
			id: "file-1",
			name: "demo.mov",
			status: "uploading",
			progress: 42.4,
		})

		render(<UploadFileMentionNodeView {...createProps()} />)

		const fileName = screen.getByText("demo.mov")
		expect(fileName).toBeInTheDocument()
		const mention = fileName.closest(".magic-mention")
		const visual = screen.getByTestId("upload-file-mention-visual")
		expect(mention).toHaveClass(
			"!inline-flex",
			"!overflow-visible",
			"!bg-transparent",
			"!p-0",
			"!align-middle",
			"!-top-px",
		)
		expect(visual).toHaveClass(
			"h-[18px]",
			"items-center",
			"overflow-hidden",
			"rounded",
			"bg-muted",
			"leading-none",
		)
		expect(screen.getByTestId("upload-file-mention-progress")).toHaveTextContent("42%")
		expect(screen.getByTestId("upload-file-mention-progress-background")).toHaveStyle({
			width: "42%",
		})
	})

	it("restores the original mention style after upload completion", () => {
		storeMocks.getFileById.mockReturnValue({
			id: "file-1",
			name: "demo.mov",
			status: "done",
			progress: 100,
		})

		render(<UploadFileMentionNodeView {...createProps()} />)

		const mention = screen.getByText("demo.mov").closest(".magic-mention")
		expect(mention).toHaveClass("magic-mention")
		expect(screen.getByTestId("upload-file-mention-visual")).toHaveClass(
			"bg-primary-10",
			"text-primary",
		)
		expect(screen.queryByTestId("upload-file-mention-progress")).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("upload-file-mention-progress-background"),
		).not.toBeInTheDocument()
	})

	it("shows zero immediately while an upload is initializing", () => {
		storeMocks.getFileById.mockReturnValue({
			id: "file-1",
			name: "demo.mov",
			status: "init",
		})

		render(<UploadFileMentionNodeView {...createProps()} />)

		expect(screen.getByTestId("upload-file-mention-progress")).toHaveTextContent("0%")
	})

	it("falls back to mention attributes when live state is unavailable", () => {
		storeMocks.hasStore = false

		render(
			<UploadFileMentionNodeView
				{...createProps({ upload_status: "uploading", upload_progress: 75 })}
			/>,
		)

		expect(screen.getByTestId("upload-file-mention-progress")).toHaveTextContent("75%")
	})

	it("shows the live failure state", () => {
		storeMocks.getFileById.mockReturnValue({
			id: "file-1",
			name: "demo.mov",
			status: "error",
			error: "network error",
		})

		render(<UploadFileMentionNodeView {...createProps()} />)

		expect(screen.getByText("fileUpload.uploadFailed")).toBeInTheDocument()
		expect(screen.queryByTestId("upload-file-mention-progress")).not.toBeInTheDocument()
	})

	it("does not rerender another file node when only one observable file changes", () => {
		const firstFile = observable({
			id: "file-1",
			name: "first.mov",
			status: "uploading" as const,
			progress: 10,
		})
		const secondFile = observable({
			id: "file-2",
			name: "second.mov",
			status: "uploading" as const,
			progress: 20,
		})
		storeMocks.getFileById.mockImplementation((fileId: string) =>
			fileId === "file-1" ? firstFile : secondFile,
		)

		render(
			<>
				<UploadFileMentionNodeView
					{...createProps({ file_id: "file-1", file_name: "first.mov" })}
				/>
				<UploadFileMentionNodeView
					{...createProps({ file_id: "file-2", file_name: "second.mov" })}
				/>
			</>,
		)
		const firstLookupCount = storeMocks.getFileById.mock.calls.filter(
			([fileId]) => fileId === "file-1",
		).length

		act(() => {
			runInAction(() => {
				secondFile.progress = 40
			})
		})

		expect(
			storeMocks.getFileById.mock.calls.filter(([fileId]) => fileId === "file-1").length,
		).toBe(firstLookupCount)
		expect(
			within(screen.getByText("second.mov").parentElement as HTMLElement).getByText("40%"),
		).toBeInTheDocument()
	})

	it("keeps long file names truncatable without shrinking the progress", () => {
		const longFileName = `${"long-".repeat(20)}file.mov`
		storeMocks.getFileById.mockReturnValue({
			id: "file-1",
			name: longFileName,
			status: "uploading",
			progress: 8,
		})

		render(<UploadFileMentionNodeView {...createProps()} />)

		expect(screen.getByTitle(longFileName)).toHaveClass("truncate")
		expect(screen.getByTestId("upload-file-mention-progress")).toHaveClass("shrink-0")
	})
})
