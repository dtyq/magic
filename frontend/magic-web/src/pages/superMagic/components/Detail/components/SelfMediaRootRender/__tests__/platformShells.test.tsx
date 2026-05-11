import { forwardRef, useEffect } from "react"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ReactElement } from "react"
import RednoteShell from "../platforms/rednote/RednoteShell"
import InstagramShell from "../platforms/instagram/InstagramShell"
import type { SelfMediaPost, SelfMediaView } from "../types"
import { AttachmentSource } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { createTestStore, wrapWithStore } from "./testStoreHelpers"
import type { StoreSeed } from "./testStoreHelpers"
import type { SelfMediaPlatform } from "../../../types"

const { addFileToCurrentChat } = vi.hoisted(() => ({
	addFileToCurrentChat: vi.fn(),
}))

vi.mock("@/pages/superMagic/utils/topics", () => ({
	addFileToCurrentChat,
	addFileToNewChat: vi.fn(),
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	workspaceStore: {
		selectedWorkspace: { id: "workspace-1" },
	},
	projectStore: {
		selectedProject: { id: "project-1" },
	},
}))

const translationMap: Record<string, string> = {
	"detail.selfMedia.common.unknownAuthor": "Unknown author",
	"detail.selfMedia.common.untitledPost": "Untitled post",
}

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => translationMap[key] || key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
}))

vi.mock("../platforms/rednote/edit", () => ({
	__esModule: true,
	default: () => <div data-testid="mock-red-edit" />,
}))

const cardFrameMountCounts = new Map<string, number>()

vi.mock("../components/CardFrame", () => ({
	__esModule: true,
	default: forwardRef(function MockCardFrame(
		{
			cardId,
			autoHeight,
			className,
		}: {
			cardId: string
			autoHeight?: boolean
			className?: string
		},
		ref,
	) {
		void ref
		useEffect(() => {
			cardFrameMountCounts.set(cardId, (cardFrameMountCounts.get(cardId) || 0) + 1)
		}, [cardId])

		return (
			<div
				data-testid="self-media-cardframe"
				data-card-id={cardId}
				data-auto-height={String(autoHeight)}
				className={className}
			/>
		)
	}),
}))

vi.mock("../components/PhoneShell", () => ({
	__esModule: true,
	default: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="self-media-phone-shell">{children}</div>
	),
}))

vi.mock("../components/ExportPanel", () => ({
	__esModule: true,
	default: ({ onOpen }: { onOpen?: () => void }) => (
		<button type="button" data-testid="self-media-export-panel" onClick={() => onOpen?.()}>
			export
		</button>
	),
}))

vi.mock("../components/ExportPreviewDialog", () => ({
	__esModule: true,
	default: ({ open }: { open: boolean }) =>
		open ? <div data-testid="self-media-export-dialog" /> : null,
}))

vi.mock("../components/PostSelector", () => ({
	__esModule: true,
	default: ({ onChange }: { onChange?: (index: number) => void }) => (
		<button
			type="button"
			data-testid="self-media-platform-selector"
			onClick={() => onChange?.(1)}
		/>
	),
}))

vi.mock("../components/ViewTabs", () => ({
	__esModule: true,
	default: () => <div data-testid="self-media-view-tabs" />,
}))

vi.mock("../hooks/useExportZip", () => ({
	useExportZip: () => ({
		progress: { current: 0, total: 0, status: "idle" },
		exportZip: vi.fn(),
	}),
}))

vi.mock("../hooks/usePhoneScaling", () => ({
	usePhoneScaling: () => ({
		containerRef: { current: null },
		scale: 1,
		width: 375,
		height: 812,
	}),
}))

const DEFAULT_POSTS: SelfMediaPost[] = [
	{
		meta: {
			id: "post-1",
			title: "Post 1",
			author: "@magic",
		},
		cards: [
			{ path: "cards/01.html", fileId: "card-1" },
			{ path: "cards/02.html", fileId: "card-2" },
			{ path: "cards/03.html", fileId: "card-3" },
		],
	},
]

function renderWithStore(
	element: ReactElement,
	overrides: Partial<StoreSeed> & { platform?: SelfMediaPlatform } = {},
) {
	const store = createTestStore({
		platform: overrides.platform ?? "rednote",
		posts: overrides.posts ?? DEFAULT_POSTS,
		view: overrides.view ?? "detail",
		activePostIndex: overrides.activePostIndex ?? 0,
		activeCardIndex: overrides.activeCardIndex ?? 1,
		loading: overrides.loading ?? false,
		error: overrides.error ?? null,
	})
	const result = render(wrapWithStore(store, element))
	return { ...result, store }
}

describe("platform shells", () => {
	it("keeps RednoteShell detail cards mounted across view switches", () => {
		cardFrameMountCounts.clear()
		const { store } = renderWithStore(<RednoteShell platform="rednote" attachmentList={[]} />)

		expect(cardFrameMountCounts.get("red-detail-post-1-0-0")).toBe(1)
		expect(cardFrameMountCounts.get("red-detail-post-1-1-0")).toBe(1)
		expect(cardFrameMountCounts.get("red-detail-post-1-2-0")).toBe(1)

		store.setView("feed")
		store.setView("detail")

		expect(cardFrameMountCounts.get("red-detail-post-1-0-0")).toBe(1)
		expect(cardFrameMountCounts.get("red-detail-post-1-1-0")).toBe(1)
		expect(cardFrameMountCounts.get("red-detail-post-1-2-0")).toBe(1)
	})

	it("renders detail arrows for RednoteShell and wires click actions", () => {
		renderWithStore(<RednoteShell platform="rednote" attachmentList={[]} />)

		const stage = screen.getByTestId("red-detail-stage")
		const prevButton = screen.getByTestId("red-detail-prev-button")
		const nextButton = screen.getByTestId("red-detail-next-button")
		const setPointerCapture = vi.fn()
		Object.defineProperty(stage, "setPointerCapture", {
			configurable: true,
			value: setPointerCapture,
		})

		expect(prevButton.className).toContain("group-hover:opacity-100")
		expect(nextButton.className).toContain("group-hover:opacity-100")

		fireEvent.pointerDown(nextButton, { pointerId: 1, clientX: 120 })
		expect(setPointerCapture).not.toHaveBeenCalled()

		fireEvent.click(nextButton)
		expect(screen.getByTestId("red-detail-dot-2").className).toContain(
			"w-4 bg-[var(--red-brand)]",
		)

		fireEvent.click(prevButton)
		expect(screen.getByTestId("red-detail-dot-1").className).toContain(
			"w-4 bg-[var(--red-brand)]",
		)
	})

	it("switches RednoteShell detail cards from mouse wheel input", () => {
		renderWithStore(<RednoteShell platform="rednote" attachmentList={[]} />)

		// Detail carousel: horizontal wheel only (vertical is reserved for page scroll)
		fireEvent.wheel(screen.getByTestId("red-detail-stage"), { deltaX: 100 })

		expect(screen.getByTestId("red-detail-dot-2").className).toContain(
			"w-4 bg-[var(--red-brand)]",
		)
	})

	it("adds the active detail card to the current chat from the action strip", () => {
		addFileToCurrentChat.mockClear()

		renderWithStore(
			<RednoteShell
				platform="rednote"
				attachmentList={[
					{
						file_id: "card-1",
						file_name: "01.html",
						relative_file_path: "posts/post-1/cards/01.html",
					},
					{
						file_id: "card-2",
						file_name: "02.html",
						relative_file_path: "posts/post-1/cards/02.html",
					},
				]}
			/>,
		)

		fireEvent.click(screen.getByTestId("red-detail-strip-add-current"))

		expect(addFileToCurrentChat).toHaveBeenCalledWith({
			fileItem: expect.objectContaining({
				file_id: "card-2",
				file_name: "02.html",
				relative_file_path: "posts/post-1/cards/02.html",
				source: AttachmentSource.PROJECT_DIRECTORY,
			}),
			isNewTopic: false,
			autoFocus: true,
		})
	})

	it("adds a scroll card to the current chat from the action strip", () => {
		addFileToCurrentChat.mockClear()

		renderWithStore(
			<RednoteShell
				platform="rednote"
				attachmentList={[
					{
						file_id: "card-1",
						file_name: "01.html",
						relative_file_path: "posts/post-1/cards/01.html",
					},
				]}
			/>,
			{ view: "scroll", activeCardIndex: 0 },
		)

		fireEvent.click(screen.getByTestId("red-scroll-card-0-add-current"))

		expect(addFileToCurrentChat).toHaveBeenCalledWith({
			fileItem: expect.objectContaining({
				file_id: "card-1",
				file_name: "01.html",
				relative_file_path: "posts/post-1/cards/01.html",
				source: AttachmentSource.PROJECT_DIRECTORY,
			}),
			isNewTopic: false,
			autoFocus: true,
		})
	})

	it("keeps RednoteShell preview mode when the toolbar selector switches posts", () => {
		renderWithStore(<RednoteShell platform="rednote" attachmentList={[]} />, {
			view: "scroll",
			posts: [
				{
					meta: {
						id: "post-1",
						title: "Post 1",
						author: "@magic",
					},
					cards: [{ path: "cards/01.html", fileId: "card-1" }],
				},
				{
					meta: {
						id: "post-2",
						title: "Post 2",
						author: "@magic-2",
					},
					cards: [{ path: "cards/02.html", fileId: "card-2" }],
				},
			],
		})

		expect(screen.getByTestId("red-scroll-view")).toBeInTheDocument()
		expect(screen.getByTestId("self-media-cardframe")).toHaveAttribute(
			"data-card-id",
			"red-scroll-post-1-0-0",
		)

		fireEvent.click(screen.getByTestId("self-media-platform-selector"))

		expect(screen.getByTestId("red-scroll-view")).toBeInTheDocument()
		expect(screen.queryByTestId("red-detail-root")).not.toBeInTheDocument()
		expect(screen.getByTestId("self-media-cardframe")).toHaveAttribute(
			"data-card-id",
			"red-scroll-post-2-0-0",
		)
	})

	it("renders RednoteShell detail header and uses page scrolling for comments", () => {
		renderWithStore(<RednoteShell platform="rednote" attachmentList={[]} />, {
			posts: [
				{
					meta: {
						id: "post-1",
						title: "用 AI 写代码，你可能踩了这 5 个坑",
						subtitle: "从「AI 能直接写完整项目」到「不写测试没问题」",
						tags: "#AI编程 #Cursor #提效",
						author: "小楠",
						time: "今天 09:41",
						location: "广东",
						commentCount: "2",
						comments: [
							{
								name: "A",
								text: "First comment",
								time: "1h",
								location: "Shanghai",
								likes: "3",
							},
							{
								name: "B",
								text: "Second comment",
								time: "2h",
								location: "Beijing",
								likes: "1",
							},
						],
					},
					cards: [
						{ path: "cards/01.html", fileId: "card-1" },
						{ path: "cards/02.html", fileId: "card-2" },
					],
				},
			],
		})

		const detailRoot = screen.getByTestId("red-detail-root")
		const detailHeader = screen.getByTestId("red-detail-header")
		const content = screen.getByTestId("red-detail-content")
		const comments = screen.getByTestId("red-detail-comments")

		expect(detailRoot.className).toContain("overflow-y-auto")
		expect(detailHeader).toBeInTheDocument()
		expect(within(content).getByText("用 AI 写代码，你可能踩了这 5 个坑")).toBeInTheDocument()
		expect(within(content).getByText("#AI编程 #Cursor #提效")).toBeInTheDocument()
		expect(within(content).getByText("今天 09:41 广东")).toBeInTheDocument()
		expect(comments.className).not.toContain("overflow-y-auto")
		expect(comments.className).not.toContain("max-h-44")
	})

	it("returns RednoteShell detail view to feed when header back is clicked", () => {
		const { store } = renderWithStore(<RednoteShell platform="rednote" attachmentList={[]} />, {
			view: "detail",
		})

		fireEvent.click(screen.getByTestId("red-detail-header-back"))

		expect(store.view).toBe<SelfMediaView>("feed")
	})

	it("renders placeholder text in RednoteShell detail when meta is missing", () => {
		renderWithStore(<RednoteShell platform="rednote" attachmentList={[]} />, {
			view: "detail",
			posts: [
				{
					meta: {
						id: "post-1",
						comments: [
							{
								name: "",
								text: "First comment",
							},
						],
					},
					cards: [{ path: "cards/01.html", fileId: "card-1" }],
				},
			],
		})

		expect(screen.getAllByText("Unknown author").length).toBeGreaterThan(0)
		expect(screen.getAllByText("U").length).toBeGreaterThan(0)
		expect(screen.queryByText("?")).not.toBeInTheDocument()
	})

	it("does not bubble detail wheel events to an outer wrapper", () => {
		const onWrapperWheel = vi.fn()

		renderWithStore(
			<div data-testid="outer-wheel-wrapper" onWheel={onWrapperWheel}>
				<RednoteShell platform="rednote" attachmentList={[]} />
			</div>,
			{
				posts: [
					{
						meta: {
							id: "post-1",
							title: "Post 1",
							author: "小楠",
							commentCount: "1",
							comments: [
								{
									name: "A",
									text: "First comment",
									time: "1h",
									location: "Shanghai",
									likes: "3",
								},
							],
						},
						cards: [
							{ path: "cards/01.html", fileId: "card-1" },
							{ path: "cards/02.html", fileId: "card-2" },
						],
					},
				],
			},
		)

		fireEvent.wheel(screen.getByTestId("red-detail-comments"), { deltaY: -100 })

		expect(onWrapperWheel).not.toHaveBeenCalled()
	})

	it("hides RednoteShell bottom navigation in detail view", () => {
		renderWithStore(<RednoteShell platform="rednote" attachmentList={[]} />)

		expect(
			screen.queryByText("detail.selfMedia.platform.rednote.footer.home"),
		).not.toBeInTheDocument()
	})

	it("renders scroll mode outside the phone shell in RednoteShell", () => {
		renderWithStore(<RednoteShell platform="rednote" attachmentList={[]} />, {
			view: "scroll",
		})

		expect(
			screen.getByTestId("self-media-phone-shell").closest('[aria-hidden="true"]'),
		).toBeTruthy()
		expect(screen.getAllByTestId("self-media-cardframe")[0]).toHaveAttribute(
			"data-auto-height",
			"true",
		)
	})

	it("renders detail arrows for InstagramShell and wires click actions", () => {
		renderWithStore(<InstagramShell platform="instagram" attachmentList={[]} />, {
			platform: "instagram",
		})

		const stage = screen.getByTestId("ig-detail-stage")
		const prevButton = screen.getByTestId("instagram-detail-prev-button")
		const nextButton = screen.getByTestId("instagram-detail-next-button")
		const setPointerCapture = vi.fn()
		Object.defineProperty(stage, "setPointerCapture", {
			configurable: true,
			value: setPointerCapture,
		})

		expect(prevButton.className).toContain("group-hover:opacity-100")
		expect(nextButton.className).toContain("group-hover:opacity-100")

		fireEvent.pointerDown(nextButton, { pointerId: 1, clientX: 120 })
		expect(setPointerCapture).not.toHaveBeenCalled()

		fireEvent.click(nextButton)
		expect(screen.getByTestId("ig-detail-dot-2").className).toContain("bg-[#3897f0]")

		fireEvent.click(prevButton)
		expect(screen.getByTestId("ig-detail-dot-1").className).toContain("bg-[#3897f0]")
	})

	it("switches Instagram detail cards from mouse wheel input", () => {
		renderWithStore(<InstagramShell platform="instagram" attachmentList={[]} />, {
			platform: "instagram",
		})

		fireEvent.wheel(screen.getByTestId("ig-detail-stage"), { deltaY: 100 })

		expect(screen.getByTestId("ig-detail-dot-2").className).toContain("bg-[#3897f0]")
	})

	it("does not bubble Instagram detail wheel events to an outer wrapper", () => {
		const onWrapperWheel = vi.fn()

		renderWithStore(
			<div data-testid="outer-instagram-wheel-wrapper" onWheel={onWrapperWheel}>
				<InstagramShell platform="instagram" attachmentList={[]} />
			</div>,
			{
				platform: "instagram",
				posts: [
					{
						meta: {
							id: "post-1",
							title: "Post 1",
							author: "@magic",
							tags: "#ai",
							commentCount: "1",
							comments: [
								{
									name: "A",
									text: "First comment",
									time: "1h",
									location: "Shanghai",
									likes: "3",
								},
							],
						},
						cards: [
							{ path: "cards/01.html", fileId: "card-1" },
							{ path: "cards/02.html", fileId: "card-2" },
						],
					},
				],
			},
		)

		fireEvent.wheel(screen.getByText("First comment"), { deltaY: -100 })

		expect(onWrapperWheel).not.toHaveBeenCalled()
	})

	it("renders placeholder text in Instagram views when meta is missing", () => {
		const posts: SelfMediaPost[] = [
			{
				meta: {
					id: "post-1",
					comments: [
						{
							name: "",
							text: "First comment",
						},
					],
				},
				cards: [{ path: "cards/01.html", fileId: "card-1" }],
			},
		]

		const { rerender, store } = renderWithStore(
			<InstagramShell platform="instagram" attachmentList={[]} />,
			{
				platform: "instagram",
				view: "feed",
				posts,
			},
		)

		expect(screen.getAllByText("Unknown author").length).toBeGreaterThan(0)
		expect(screen.getByText("Untitled post")).toBeInTheDocument()
		expect(screen.queryByText("?")).not.toBeInTheDocument()

		store.setView("detail")
		rerender(wrapWithStore(store, <InstagramShell platform="instagram" attachmentList={[]} />))

		expect(screen.getAllByText("Unknown author").length).toBeGreaterThan(0)
		expect(screen.queryByText("?")).not.toBeInTheDocument()
	})

	it("renders scroll mode outside the phone shell in InstagramShell", () => {
		renderWithStore(<InstagramShell platform="instagram" attachmentList={[]} />, {
			platform: "instagram",
			view: "scroll",
		})

		expect(
			screen.getByTestId("self-media-phone-shell").closest('[aria-hidden="true"]'),
		).toBeTruthy()
		expect(screen.getAllByTestId("self-media-cardframe")[0]).toHaveAttribute(
			"data-auto-height",
			"true",
		)
	})
})
