import { useEffect } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { observer } from "mobx-react-lite"
import { describe, expect, it, vi } from "vitest"
import RednoteShell from "../platforms/rednote/RednoteShell"
import { cacheKey } from "../services"
import type { PlatformSlice } from "../services"
import { SelfMediaStore } from "../stores"
import type { SelfMediaPost, SelfMediaPostEntry, SelfMediaView } from "../types"
import { createFakeService, createTestStore, wrapWithStore } from "./testStoreHelpers"

const STUB_ATTACHMENT_TREE = [
	{ file_id: "root", file_name: "root", is_directory: true, relative_file_path: "root/" },
] as never

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
}))

vi.mock("@/pages/superMagic/utils/topics", () => ({
	addFileToCurrentChat: vi.fn(),
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

vi.mock("../components/PhoneShell", () => ({
	__esModule: true,
	default: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="self-media-phone-shell">{children}</div>
	),
}))

vi.mock("../components/ExportPanel", () => ({
	__esModule: true,
	default: () => <button type="button" data-testid="self-media-export-panel" />,
}))

vi.mock("../components/ExportPreviewDialog", () => ({
	__esModule: true,
	default: () => null,
}))

vi.mock("../components/PostSelector", () => ({
	__esModule: true,
	default: function MockPostSelector({ onChange }: { onChange: (index: number) => void }) {
		return (
			<div data-testid="self-media-platform-selector">
				<button
					type="button"
					data-testid="self-media-platform-selector-post-1"
					onClick={() => onChange(1)}
				>
					post-1
				</button>
			</div>
		)
	},
}))

vi.mock("../components/ViewTabs", () => ({
	__esModule: true,
	default: function MockViewTabs({ onChange }: { onChange: (view: SelfMediaView) => void }) {
		return (
			<div data-testid="self-media-view-tabs">
				<button
					type="button"
					data-testid="self-media-view-detail"
					onClick={() => onChange("detail")}
				>
					detail
				</button>
				<button
					type="button"
					data-testid="self-media-view-feed"
					onClick={() => onChange("feed")}
				>
					feed
				</button>
			</div>
		)
	},
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

vi.mock("../platforms/rednote/feed", () => ({
	__esModule: true,
	default: () => <div data-testid="red-feed-view" />,
}))

vi.mock("../platforms/rednote/detail", async () => {
	const react = await import("react")
	const mobx = await import("mobx-react-lite")
	const stores = await import("../stores")

	const MockDetail = mobx.observer(function MockRednoteDetail({
		onChangeCard,
	}: {
		onChangeCard?: (index: number) => void
	}) {
		const store = stores.useSelfMediaStore()
		const cardIndex = store.activeCardIndex
		react.useEffect(() => {
			if (cardIndex === 1) onChangeCard?.(0)
		}, [cardIndex, onChangeCard])
		return <div data-testid="mock-red-detail" data-card-index={cardIndex} />
	})

	return {
		__esModule: true,
		RednoteDetailView: MockDetail,
		RednoteScrollView: () => <div data-testid="mock-rednote-scroll" />,
		RednoteFooter: () => <div data-testid="mock-red-footer" />,
	}
})

vi.mock("../platforms/rednote/edit", async () => {
	const react = await import("react")
	const mobx = await import("mobx-react-lite")
	const stores = await import("../stores")

	const MockEdit = mobx.observer(function MockRednoteEdit({
		onEditingStateChange,
		onRequestViewChangeReady,
		onRequestPostChangeReady,
	}: {
		onEditingStateChange?: (editing: boolean) => void
		onRequestViewChangeReady?: (handler: ((nextView: SelfMediaView) => void) | null) => void
		onRequestPostChangeReady?: (handler: ((nextPostIndex: number) => void) | null) => void
	}) {
		const store = stores.useSelfMediaStore()
		const activeCardIndex = store.activeCardIndex
		const [requestMode, setRequestMode] = react.useState<"success" | "fail">("success")
		const [showRetryPrompt, setShowRetryPrompt] = react.useState(false)

		react.useEffect(() => {
			onRequestViewChangeReady?.((nextView) => {
				if (requestMode === "success") {
					onEditingStateChange?.(false)
					store.setView(nextView)
					return
				}
				setShowRetryPrompt(true)
			})

			return () => onRequestViewChangeReady?.(null)
		}, [onEditingStateChange, onRequestViewChangeReady, requestMode, store])

		react.useEffect(() => {
			onRequestPostChangeReady?.((nextPostIndex) => {
				if (requestMode === "success") {
					onEditingStateChange?.(false)
					store.setActivePostIndex(nextPostIndex)
					return
				}
				setShowRetryPrompt(true)
			})

			return () => onRequestPostChangeReady?.(null)
		}, [onEditingStateChange, onRequestPostChangeReady, requestMode, store])

		return (
			<div data-testid="mock-red-edit" data-card-index={activeCardIndex}>
				<button
					type="button"
					data-testid="mock-red-edit-start-dirty"
					onClick={() => onEditingStateChange?.(true)}
				>
					dirty
				</button>
				<button
					type="button"
					data-testid="mock-red-edit-clear-dirty"
					onClick={() => onEditingStateChange?.(false)}
				>
					clean
				</button>
				<button
					type="button"
					data-testid="mock-red-edit-request-success"
					onClick={() => setRequestMode("success")}
				>
					success
				</button>
				<button
					type="button"
					data-testid="mock-red-edit-request-fail"
					onClick={() => setRequestMode("fail")}
				>
					fail
				</button>
				<button
					type="button"
					data-testid="mock-red-edit-switch"
					onClick={() => store.setActiveCardIndex(1)}
				>
					switch
				</button>
				{showRetryPrompt ? <div data-testid="mock-red-edit-retry-prompt">retry</div> : null}
			</div>
		)
	})

	return {
		__esModule: true,
		default: MockEdit,
	}
})

const StoreProbe = observer(function StoreProbe({ store }: { store: SelfMediaStore }) {
	return (
		<>
			<div data-testid="current-view">{store.view}</div>
			<div data-testid="current-post-index">{store.activePostIndex}</div>
		</>
	)
})

function renderShellInEditView() {
	const store = createTestStore({
		platform: "rednote",
		view: "detail",
		posts: [
			{
				meta: {
					id: "post-1",
					title: "Post 1",
					author: "@magic",
				},
				cards: [
					{ path: "cards/01.html", fileId: "card-1" },
					{ path: "cards/02.html", fileId: "card-2" },
				],
			},
		],
	})

	function Harness() {
		useEffect(() => {
			store.setView("edit")
		}, [])
		return (
			<>
				<StoreProbe store={store} />
				<RednoteShell platform="rednote" attachmentList={[]} />
			</>
		)
	}

	render(wrapWithStore(store, <Harness />))
	return { store }
}

describe("RednoteShell edit view", () => {
	it("allows switching back to another view when edit has no unsaved changes", async () => {
		renderShellInEditView()

		await waitFor(() => {
			expect(screen.getByTestId("current-view").textContent).toBe("edit")
		})

		fireEvent.click(screen.getByTestId("self-media-view-detail"))

		await waitFor(() => {
			expect(screen.getByTestId("current-view").textContent).toBe("detail")
		})
	})

	it("auto switches after save succeeds when clicking another view", async () => {
		renderShellInEditView()

		await waitFor(() => {
			expect(screen.getByTestId("current-view").textContent).toBe("edit")
		})

		fireEvent.click(screen.getByTestId("mock-red-edit-start-dirty"))
		fireEvent.click(screen.getByTestId("mock-red-edit-request-success"))
		fireEvent.click(screen.getByTestId("self-media-view-feed"))

		await waitFor(() => {
			expect(screen.getByTestId("current-view").textContent).toBe("feed")
		})
	})

	it("keeps edit view active and shows retry prompt when save fails", async () => {
		renderShellInEditView()

		await waitFor(() => {
			expect(screen.getByTestId("current-view").textContent).toBe("edit")
		})

		fireEvent.click(screen.getByTestId("mock-red-edit-start-dirty"))
		fireEvent.click(screen.getByTestId("mock-red-edit-request-fail"))
		fireEvent.click(screen.getByTestId("self-media-view-feed"))

		await waitFor(() => {
			expect(screen.getByTestId("current-view").textContent).toBe("edit")
		})
		expect(screen.getByTestId("mock-red-edit-retry-prompt")).toBeInTheDocument()
	})

	it("auto switches post after save succeeds when selecting another post", async () => {
		renderShellInEditView()

		await waitFor(() => {
			expect(screen.getByTestId("current-view").textContent).toBe("edit")
		})

		fireEvent.click(screen.getByTestId("mock-red-edit-start-dirty"))
		fireEvent.click(screen.getByTestId("mock-red-edit-request-success"))
		fireEvent.click(screen.getByTestId("self-media-platform-selector-post-1"))

		await waitFor(() => {
			expect(screen.getByTestId("current-post-index").textContent).toBe("1")
		})
		expect(screen.getByTestId("current-view").textContent).toBe("edit")
	})

	it("keeps current post and shows retry prompt when post save fails", async () => {
		renderShellInEditView()

		await waitFor(() => {
			expect(screen.getByTestId("current-post-index").textContent).toBe("0")
		})

		fireEvent.click(screen.getByTestId("mock-red-edit-start-dirty"))
		fireEvent.click(screen.getByTestId("mock-red-edit-request-fail"))
		fireEvent.click(screen.getByTestId("self-media-platform-selector-post-1"))

		await waitFor(() => {
			expect(screen.getByTestId("current-post-index").textContent).toBe("0")
		})
		expect(screen.getByTestId("mock-red-edit-retry-prompt")).toBeInTheDocument()
	})

	it("ignores hidden detail card sync while editing", async () => {
		renderShellInEditView()

		await waitFor(() => {
			expect(screen.getByTestId("mock-red-edit")).toBeInTheDocument()
		})

		fireEvent.click(screen.getByTestId("mock-red-edit-switch"))

		await waitFor(() => {
			expect(screen.getByTestId("mock-red-edit").getAttribute("data-card-index")).toBe("1")
		})
	})

	it("header refresh re-runs store initialize from last sync context", async () => {
		const service = createFakeService()
		const store = new SelfMediaStore(service)
		const post: SelfMediaPost = {
			meta: {
				id: "post-1",
				title: "Post 1",
				author: "@magic",
			},
			cards: [
				{ path: "cards/01.html", fileId: "card-1" },
				{ path: "cards/02.html", fileId: "card-2" },
			],
		}
		const entry: SelfMediaPostEntry = {
			id: "post-1",
			name: "Post 1",
			entry: "posts/post-1/post.json",
		}
		const slice = {
			platform: "rednote",
			config: { posts: [entry] },
			postEntries: [entry],
		} as PlatformSlice
		const snap = {
			slices: [slice],
			loadedPosts: { [cacheKey("rednote", "post-1")]: post },
			error: null,
			folderRelativePath: "/",
		}
		service.initialize.mockResolvedValueOnce(snap)
		service.ensurePostLoaded.mockResolvedValue(post)

		await store.sync({ folderFileId: "folder-1", attachmentList: STUB_ATTACHMENT_TREE })

		service.initialize.mockResolvedValueOnce(snap)
		service.ensurePostLoaded.mockResolvedValue(post)

		function Harness() {
			useEffect(() => {
				store.setView("edit")
			}, [])
			return (
				<>
					<StoreProbe store={store} />
					<RednoteShell platform="rednote" attachmentList={[]} />
				</>
			)
		}

		render(wrapWithStore(store, <Harness />))

		await waitFor(() => {
			expect(screen.getByTestId("current-view").textContent).toBe("edit")
		})

		fireEvent.click(screen.getByTestId("rednote-shell-refresh-post-button"))

		await waitFor(() => {
			expect(service.initialize).toHaveBeenCalledTimes(2)
		})
	})
})
