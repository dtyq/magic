import { fireEvent, render, screen, waitFor, act } from "@testing-library/react"
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { useEffect, type ReactNode } from "react"
import type { AttachmentItem } from "../hooks/types"
import { ProjectFileImageThumbnailIcon } from "./ProjectFileImageThumbnailIcon"
import {
	ProjectFileImagePreviewProvider,
	resolveProjectFileImagePreviewSource,
	useProjectFileImagePreviewManager,
} from "./ProjectFileImagePreviewProvider"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import {
	__resetProjectFileImagePreviewCoordinatorForTests,
	seedProjectFileImagePreviewCacheItem,
} from "./projectFileImagePreviewCoordinator"
import { __resetProjectFileImagePreviewRuntimeForTests } from "./projectFileImagePreviewRuntime"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: vi.fn(),
}))

function PreviewHarness({
	attachments,
	children,
	mountAll = true,
	onRender,
}: {
	attachments: AttachmentItem[]
	children: ReactNode
	mountAll?: boolean
	onRender?: () => void
}) {
	onRender?.()
	const manager = useProjectFileImagePreviewManager({ attachments })
	const { setMountedItems } = manager

	useEffect(() => {
		setMountedItems(mountAll ? attachments : [])
	}, [attachments, mountAll, setMountedItems])

	return (
		<ProjectFileImagePreviewProvider manager={manager}>
			{children}
		</ProjectFileImagePreviewProvider>
	)
}

describe("ProjectFileImageThumbnailIcon", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(getTemporaryDownloadUrl).mockReset()
		__resetProjectFileImagePreviewCoordinatorForTests()
		__resetProjectFileImagePreviewRuntimeForTests()
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		vi.useRealTimers()
	})

	it("renders an explicit thumbnail url directly", async () => {
		const item: AttachmentItem = {
			file_id: "file-direct",
			file_name: "cover.png",
			file_extension: "png",
			thumbnail_url: "https://cdn.example.com/cover-thumb.webp",
		}

		render(
			<ProjectFileImageThumbnailIcon
				item={item}
				fallback={<div data-testid="fallback-icon" />}
			/>,
		)

		const image = screen.getByTestId("project-file-image-thumbnail-image")
		expect(image).toHaveAttribute("src", "https://cdn.example.com/cover-thumb.webp")
		expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()

		fireEvent.load(image)

		await waitFor(() => {
			expect(
				screen.queryByTestId("project-file-image-thumbnail-loading"),
			).not.toBeInTheDocument()
		})
	})

	it("batches mounted image thumbnails through the list-level manager", async () => {
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([
			{
				file_id: "file-a",
				url: "https://cdn.example.com/a-thumb.webp",
				expires_at: "2099-01-01 00:00:00",
			},
			{
				file_id: "file-b",
				url: "https://cdn.example.com/b-thumb.webp",
				expires_at: "2099-01-01 00:00:00",
			},
		])

		const attachments: AttachmentItem[] = [
			{
				file_id: "file-a",
				file_name: "a.png",
				file_extension: "png",
			},
			{
				file_id: "file-b",
				file_name: "b.png",
				file_extension: "png",
			},
		]

		render(
			<PreviewHarness attachments={attachments}>
				<div>
					<ProjectFileImageThumbnailIcon
						item={attachments[0]}
						fallback={<div data-testid="fallback-a" />}
					/>
					<ProjectFileImageThumbnailIcon
						item={attachments[1]}
						fallback={<div data-testid="fallback-b" />}
					/>
				</div>
			</PreviewHarness>,
		)

		await waitFor(() => {
			expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
		})

		expect(vi.mocked(getTemporaryDownloadUrl)).toHaveBeenCalledWith({
			file_ids: ["file-a", "file-b"],
			options: {
				xMagicImageProcess: {
					resize: { w: 320, h: 320, m: "lfit" },
					quality: 45,
					format: "webp",
					autoOrient: 1,
				},
			},
			enableErrorMessagePrompt: false,
		})

		expect(await screen.findAllByTestId("project-file-image-thumbnail-image")).toHaveLength(2)
	})

	it("updates subscribed thumbnails without rerendering the list manager parent", async () => {
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([
			{
				file_id: "file-render-scope",
				url: "https://cdn.example.com/render-scope.webp",
				expires_at: "2099-01-01 00:00:00",
			},
		])
		const item: AttachmentItem = {
			file_id: "file-render-scope",
			file_name: "render-scope.png",
			file_extension: "png",
		}
		const onRender = vi.fn()

		render(
			<PreviewHarness attachments={[item]} onRender={onRender}>
				<ProjectFileImageThumbnailIcon item={item} fallback={<div />} />
			</PreviewHarness>,
		)
		const parentRenderCount = onRender.mock.calls.length

		expect(await screen.findByTestId("project-file-image-thumbnail-image")).toHaveAttribute(
			"src",
			"https://cdn.example.com/render-scope.webp",
		)
		expect(onRender).toHaveBeenCalledTimes(parentRenderCount)
	})

	it("does not reuse another file url when a batch response misses one item", async () => {
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([
			{
				file_id: "file-missing-a",
				url: "https://cdn.example.com/missing-a-thumb.webp",
				expires_at: "2099-01-01 00:00:00",
			},
		])

		const attachments: AttachmentItem[] = [
			{
				file_id: "file-missing-a",
				file_name: "a.png",
				file_extension: "png",
			},
			{
				file_id: "file-missing-b",
				file_name: "b.png",
				file_extension: "png",
			},
		]

		render(
			<PreviewHarness attachments={attachments}>
				<div>
					<ProjectFileImageThumbnailIcon
						item={attachments[0]}
						fallback={<div data-testid="fallback-a" />}
					/>
					<ProjectFileImageThumbnailIcon
						item={attachments[1]}
						fallback={<div data-testid="fallback-b" />}
					/>
				</div>
			</PreviewHarness>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("fallback-b")).toBeInTheDocument()
		})

		const images = screen.getAllByTestId("project-file-image-thumbnail-image")
		expect(images).toHaveLength(1)
		expect(images[0]).toHaveAttribute("src", "https://cdn.example.com/missing-a-thumb.webp")
	})

	it("removes sources that leave the mounted window before the batch is admitted", async () => {
		vi.useFakeTimers()
		const item: AttachmentItem = {
			file_id: "file-offscreen",
			file_name: "offscreen.png",
			file_extension: "png",
		}
		const { rerender } = render(
			<PreviewHarness attachments={[item]}>
				<div />
			</PreviewHarness>,
		)

		rerender(
			<PreviewHarness attachments={[]}>
				<div />
			</PreviewHarness>,
		)
		await act(async () => {
			vi.advanceTimersByTime(200)
		})

		expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()
	})

	it("only exchanges uncached image rows reported near the viewport", async () => {
		vi.useFakeTimers()
		let observerCallback: IntersectionObserverCallback | undefined
		const observedElements: Element[] = []
		const observer = {
			root: null,
			rootMargin: "320px 0px",
			thresholds: [0],
			disconnect: vi.fn(),
			observe: vi.fn((element: Element) => observedElements.push(element)),
			takeRecords: vi.fn(() => []),
			unobserve: vi.fn(),
		}
		vi.stubGlobal(
			"IntersectionObserver",
			vi.fn((callback: IntersectionObserverCallback) => {
				observerCallback = callback
				return observer
			}),
		)

		const attachments = Array.from({ length: 100 }, (_, index) => ({
			file_id: `viewport-file-${index}`,
			file_name: `viewport-${index}.png`,
			file_extension: "png",
		})) satisfies AttachmentItem[]
		for (const item of attachments.slice(0, 3)) {
			const source = resolveProjectFileImagePreviewSource(item)
			if (!source) throw new Error("Expected an image preview source")
			seedProjectFileImagePreviewCacheItem(source, {
				url: `https://cdn.example.com/${item.file_id}.webp?from=memory`,
				expiresAt: "2099-01-01 00:00:00",
			})
		}
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce(
			attachments.slice(3, 6).map((item) => ({
				file_id: item.file_id || "",
				url: `https://cdn.example.com/${item.file_id}.webp`,
				expires_at: "2099-01-01 00:00:00",
			})),
		)

		render(
			<PreviewHarness attachments={attachments} mountAll={false}>
				{attachments.map((item) => (
					<ProjectFileImageThumbnailIcon
						key={item.file_id}
						item={item}
						fallback={<div />}
					/>
				))}
			</PreviewHarness>,
		)

		expect(observedElements).toHaveLength(100)
		expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()
		expect(screen.queryAllByTestId("project-file-image-thumbnail-image")).toHaveLength(3)
		await act(async () => {
			observerCallback?.(
				observedElements
					.slice(0, 6)
					.map(
						(target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry,
					),
				observer as IntersectionObserver,
			)
		})
		expect(screen.getAllByTestId("project-file-image-thumbnail-image")).toHaveLength(3)
		expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()
		await act(async () => {
			vi.advanceTimersByTime(32)
			await Promise.resolve()
		})

		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
		expect(vi.mocked(getTemporaryDownloadUrl).mock.calls[0]?.[0].file_ids).toEqual([
			"viewport-file-3",
			"viewport-file-4",
			"viewport-file-5",
		])
	})

	it("falls back to the file icon for non-image files", () => {
		const item: AttachmentItem = {
			file_id: "file-text",
			file_name: "notes.txt",
			file_extension: "txt",
		}

		render(
			<ProjectFileImageThumbnailIcon
				item={item}
				fallback={<div data-testid="fallback-icon" />}
			/>,
		)

		expect(screen.getByTestId("fallback-icon")).toBeInTheDocument()
		expect(screen.queryByTestId("project-file-image-thumbnail")).not.toBeInTheDocument()
		expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()
	})

	it("falls back immediately when a direct thumbnail fails to load", () => {
		const item: AttachmentItem = {
			file_id: "file-error",
			file_name: "broken.png",
			file_extension: "png",
			thumbnail_url: "https://cdn.example.com/broken-thumb.webp",
		}

		render(
			<ProjectFileImageThumbnailIcon
				item={item}
				fallback={<div data-testid="fallback-icon" />}
			/>,
		)

		fireEvent.error(screen.getByTestId("project-file-image-thumbnail-image"))

		expect(screen.getByTestId("fallback-icon")).toBeInTheDocument()
		expect(getTemporaryDownloadUrl).not.toHaveBeenCalled()
	})

	it("keeps an unexpired exchanged url cached after its first image load failure", async () => {
		vi.useFakeTimers()
		const item: AttachmentItem = {
			file_id: "file-exchanged-error",
			file_name: "exchanged-error.png",
			file_extension: "png",
		}
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([
			{
				file_id: item.file_id || "",
				url: "https://cdn.example.com/exchanged-error.webp?signature=stable",
				expires_at: "2099-01-01 00:00:00",
			},
		])

		render(
			<PreviewHarness attachments={[item]}>
				<ProjectFileImageThumbnailIcon
					item={item}
					fallback={<div data-testid="fallback-icon" />}
				/>
			</PreviewHarness>,
		)
		await act(async () => {
			vi.advanceTimersByTime(80)
			await Promise.resolve()
		})

		const image = screen.getByTestId("project-file-image-thumbnail-image")
		expect(image).toHaveAttribute(
			"src",
			"https://cdn.example.com/exchanged-error.webp?signature=stable",
		)
		fireEvent.error(image)

		expect(screen.getByTestId("fallback-icon")).toBeInTheDocument()
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
	})
})
