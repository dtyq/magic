import { act, fireEvent, render, screen } from "@testing-library/react"
import { useEffect, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import type { AttachmentItem } from "../hooks/types"
import {
	ProjectFileImagePreviewProvider,
	resolveProjectFileImagePreviewSource,
	useProjectFileImagePreviewManager,
} from "./ProjectFileImagePreviewProvider"
import { ProjectFileImageSmartTooltip } from "./ProjectFileImageSmartTooltip"
import { __resetProjectFileImagePreviewCoordinatorForTests } from "./projectFileImagePreviewCoordinator"
import { __resetProjectFileImagePreviewRuntimeForTests } from "./projectFileImagePreviewRuntime"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: vi.fn(),
}))

vi.mock("@/components/other/SmartTooltip", () => ({
	default: ({
		children,
		content,
		forceShowTooltip,
		onOpenChange,
	}: {
		children?: ReactNode
		content?: ReactNode
		forceShowTooltip?: boolean
		onOpenChange?: (open: boolean) => void
	}) => (
		<div
			data-testid="smart-tooltip"
			data-force-show={String(Boolean(forceShowTooltip))}
			data-has-custom-content={String(content !== undefined && content !== null)}
		>
			<span>{children}</span>
			<button type="button" onClick={() => onOpenChange?.(true)}>
				open
			</button>
			{content}
		</div>
	),
}))

vi.mock("@/components/base/MediaPreview", () => ({
	MediaPreviewTrigger: ({
		source,
		fileName,
		renderTrigger,
	}: {
		source: {
			previewUrl?: string | null
			isLoading: boolean
			hasError: boolean
			loadPreview?: () => Promise<void>
		}
		fileName: string
		renderTrigger: (thumbnail: ReactNode) => ReactNode
	}) => (
		<div
			data-testid="media-preview-trigger"
			data-file-name={fileName}
			data-preview-url={source.previewUrl ?? ""}
			data-loading={String(source.isLoading)}
			data-error={String(source.hasError)}
		>
			{renderTrigger(null)}
			<button type="button" onClick={() => void source.loadPreview?.()}>
				open
			</button>
		</div>
	),
}))

function PreviewHarness({ item, children }: { item: AttachmentItem; children: ReactNode }) {
	const manager = useProjectFileImagePreviewManager({ attachments: [item] })
	const { setMountedItems } = manager

	useEffect(() => {
		setMountedItems([item])
	}, [item, setMountedItems])

	return (
		<ProjectFileImagePreviewProvider manager={manager}>
			{children}
		</ProjectFileImagePreviewProvider>
	)
}

describe("ProjectFileImageSmartTooltip", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.mocked(getTemporaryDownloadUrl).mockReset()
		__resetProjectFileImagePreviewCoordinatorForTests()
		__resetProjectFileImagePreviewRuntimeForTests()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("uses the shared media preview trigger for project images", async () => {
		const item: AttachmentItem = {
			file_id: "tooltip-image-error",
			file_name: "tooltip-image-error.png",
			file_extension: "png",
		}
		const source = resolveProjectFileImagePreviewSource(item)
		if (!source) throw new Error("Expected an image preview source")
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([
			{
				file_id: item.file_id || "",
				url: "https://cdn.example.com/tooltip-image-error.webp",
				expires_at: "2099-01-01 00:00:00",
			},
		])

		render(
			<PreviewHarness item={item}>
				<ProjectFileImageSmartTooltip source={source}>
					{item.file_name}
				</ProjectFileImageSmartTooltip>
			</PreviewHarness>,
		)
		await act(async () => {
			vi.advanceTimersByTime(32)
			await Promise.resolve()
		})

		expect(screen.getByTestId("media-preview-trigger")).toHaveAttribute(
			"data-preview-url",
			"https://cdn.example.com/tooltip-image-error.webp",
		)
		expect(screen.getByText("tooltip-image-error.png")).toBeInTheDocument()
	})

	it("uses the shared error state when no preview url is available", async () => {
		const item: AttachmentItem = {
			file_id: "tooltip-exchange-error",
			file_name: "tooltip-exchange-error.png",
			file_extension: "png",
		}
		const source = resolveProjectFileImagePreviewSource(item)
		if (!source) throw new Error("Expected an image preview source")
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValueOnce([])

		render(
			<PreviewHarness item={item}>
				<ProjectFileImageSmartTooltip source={source}>
					{item.file_name}
				</ProjectFileImageSmartTooltip>
			</PreviewHarness>,
		)
		await act(async () => {
			vi.advanceTimersByTime(32)
			await Promise.resolve()
		})

		expect(screen.getByTestId("media-preview-trigger")).toHaveAttribute("data-error", "true")

		fireEvent.click(screen.getByRole("button", { name: "open" }))
		await act(async () => {
			vi.advanceTimersByTime(200)
			await Promise.resolve()
		})
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
	})

	it("retries a failed url exchange when the tooltip opens again", async () => {
		const item: AttachmentItem = {
			file_id: "tooltip-exchange-retry",
			file_name: "tooltip-exchange-retry.png",
			file_extension: "png",
		}
		const source = resolveProjectFileImagePreviewSource(item)
		if (!source) throw new Error("Expected an image preview source")
		vi.mocked(getTemporaryDownloadUrl)
			.mockRejectedValueOnce(new Error("temporary exchange failure"))
			.mockResolvedValueOnce([
				{
					file_id: item.file_id || "",
					url: "https://cdn.example.com/tooltip-exchange-retry.webp",
					expires_at: "2099-01-01 00:00:00",
				},
			])

		render(
			<PreviewHarness item={item}>
				<ProjectFileImageSmartTooltip source={source}>
					{item.file_name}
				</ProjectFileImageSmartTooltip>
			</PreviewHarness>,
		)
		await act(async () => {
			vi.advanceTimersByTime(32)
			await Promise.resolve()
		})

		expect(screen.getByTestId("media-preview-trigger")).toHaveAttribute("data-error", "true")

		fireEvent.click(screen.getByRole("button", { name: "open" }))
		await act(async () => {
			vi.advanceTimersByTime(80)
			await Promise.resolve()
		})

		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2)
		expect(screen.getByTestId("media-preview-trigger")).toHaveAttribute(
			"data-preview-url",
			"https://cdn.example.com/tooltip-exchange-retry.webp",
		)
	})
})
