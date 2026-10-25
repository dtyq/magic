import { act, createRef, useEffect, useRef, useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useFullscreen } from "@/pages/superMagic/components/Detail/components/PPTRender/hooks/useFullscreen"
import { DetailType } from "@/pages/superMagic/components/Detail/types"
import PreviewDetailPopup, { type PreviewDetailPopupRef } from ".."

const testState = vi.hoisted(() => ({ isMobile: false, renderUnmounted: vi.fn() }))
const nativeApiDescriptors = ["fullscreenElement", "exitFullscreen"].map((key) => ({
	key,
	descriptor: Object.getOwnPropertyDescriptor(document, key),
}))

vi.mock("ahooks", async (importOriginal) => ({
	...(await importOriginal<typeof import("ahooks")>()),
	useResponsive: () => ({ md: !testState.isMobile }),
}))
vi.mock("@/stores/interface", () => ({ interfaceStore: { setIsMobile: vi.fn() } }))
vi.mock("@/providers/MagicWidgetProvider/context", () => ({
	useMagicWidgetConfig: () => ({ config: {}, embedContext: null }),
}))

vi.mock("react-router", () => ({
	useLocation: () => ({ pathname: "/project", search: "" }),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("antd-mobile", () => ({
	Toast: { show: vi.fn() },
}))

vi.mock("@/pages/superMagic/components/Detail/hooks/useDetailActions", async () => {
	const React = await import("react")

	return {
		useDetailActions: () => {
			const [isFullscreen, setIsFullscreen] = React.useState(false)

			React.useEffect(() => {
				const handleKeyDown = (event: KeyboardEvent) => {
					if (event.key === "Escape" && isFullscreen) setIsFullscreen(false)
				}
				document.addEventListener("keydown", handleKeyDown)
				return () => document.removeEventListener("keydown", handleKeyDown)
			}, [isFullscreen])

			return {
				isFullscreen,
				setIsFullscreen,
				isFromNode: false,
				handlePrevious: vi.fn(),
				handleNext: vi.fn(),
				handleFullscreen: () => setIsFullscreen((current) => !current),
				handleDownload: vi.fn(),
				allFiles: [],
				currentIndex: 0,
				effectiveAttachments: [],
			}
		},
	}
})

vi.mock("@/pages/superMagic/components/Detail/components/FilesViewer/utils/preview", () => ({
	correctDetailType: (detail: unknown) => detail,
}))

vi.mock("@/pages/superMagic/utils/share", () => ({ copyFileContent: vi.fn() }))

vi.mock("@/pages/superMagic/utils/handleFIle", () => ({
	getFileType: () => DetailType.Code,
}))

vi.mock("@/pages/superMagic/components/MessageList/components/MessageAttachment/utils", () => ({
	getAttachmentExtension: () => "",
}))

vi.mock("@/components/base/MagicFileIcon", () => ({ default: () => <span /> }))
vi.mock("@/pages/superMagic/components/MessageList/components/Tool/components/ToolIcon", () => ({
	default: () => <span />,
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({
		children,
		visible,
		onClose,
	}: {
		children: React.ReactNode
		visible?: boolean
		onClose?: () => void
	}) =>
		visible ? (
			<div data-testid="magic-popup">
				<button onClick={onClose}>close preview</button>
				{children}
			</div>
		) : null,
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: ({
		children,
		open,
		className,
		classNames,
		title,
		centered,
		closable,
		onCancel,
	}: {
		children: React.ReactNode
		open?: boolean
		className?: string
		classNames?: { content?: string; body?: string; header?: string }
		title?: React.ReactNode
		centered?: boolean
		closable?: boolean
		onCancel?: () => void
	}) =>
		open ? (
			<div
				data-testid="magic-modal"
				className={className}
				data-content-class={classNames?.content}
				data-body-class={classNames?.body}
				data-header-class={classNames?.header}
				data-centered={String(centered)}
				data-closable={String(closable)}
			>
				{title ? <div data-testid="magic-modal-title">{title}</div> : null}
				<button data-testid="magic-modal-cancel" onClick={onCancel} />
				{children}
			</div>
		) : null,
}))

vi.mock("@/pages/superMagic/components/Detail/Render", () => ({
	default: function MockPreviewRender({
		isFullscreen,
		onFullscreen,
		attachmentList,
	}: {
		isFullscreen?: boolean
		onFullscreen?: () => void
		attachmentList?: unknown[]
	}) {
		const containerRef = useRef<HTMLDivElement>(null)
		const presentation = useFullscreen({ containerRef, preserveMobileLayout: useIsMobile() })
		const [page, setPage] = useState(1)
		useEffect(() => testState.renderUnmounted, [])
		return (
			<div
				ref={containerRef}
				data-testid="preview-render"
				data-fullscreen={String(isFullscreen)}
				data-attachment-count={String(attachmentList?.length ?? 0)}
				data-presentation={String(presentation.isFullscreen)}
				data-page={page}
			>
				<button data-testid="preview-fullscreen" onClick={onFullscreen} />
				<button onClick={() => setPage((current) => current + 1)}>next page</button>
				<button onClick={() => void presentation.toggleFullscreen()}>
					toggle presentation
				</button>
			</div>
		)
	},
}))

function openPreview(ref: React.RefObject<PreviewDetailPopupRef | null>) {
	return act(async () => {
		ref.current?.open(
			{
				type: DetailType.Code,
				currentFileId: "file-1",
				data: {
					file_id: "file-1",
					file_name: "file.ts",
					file_extension: "ts",
				},
			},
			[],
			[],
		)
	})
}

describe("PreviewDetailPopup fullscreen", () => {
	beforeEach(() => {
		testState.isMobile = false
		testState.renderUnmounted.mockClear()
	})
	afterEach(() => {
		vi.restoreAllMocks()
		for (const { key, descriptor } of nativeApiDescriptors) {
			if (descriptor) Object.defineProperty(document, key, descriptor)
			else Reflect.deleteProperty(document, key)
		}
	})

	it.each(["native control", "native browser exit", "CSS control"])(
		"keeps the mobile popup and selected slide after %s in landscape",
		async (exitMode) => {
			testState.isMobile = true
			const popupRef = createRef<PreviewDetailPopupRef>()
			const onClose = vi.fn()
			function ResponsiveRoute() {
				return useIsMobile() ? (
					<PreviewDetailPopup
						ref={popupRef}
						setUserSelectDetail={vi.fn()}
						onClose={onClose}
					/>
				) : (
					<div>desktop route</div>
				)
			}
			const view = render(<ResponsiveRoute />)
			await openPreview(popupRef)
			const preview = screen.getByTestId("preview-render")
			let nativeFullscreen: Element | null = null
			Object.defineProperty(document, "fullscreenElement", {
				configurable: true,
				get: () => nativeFullscreen,
			})
			if (exitMode === "CSS control") {
				vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
					matches: query === "(pointer: coarse)",
					media: query,
					onchange: null,
					addListener: vi.fn(),
					removeListener: vi.fn(),
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
					dispatchEvent: vi.fn(() => true),
				}))
			} else
				preview.requestFullscreen = vi.fn(async () => {
					nativeFullscreen = preview
					document.dispatchEvent(new Event("fullscreenchange"))
				})
			Object.defineProperty(document, "exitFullscreen", {
				configurable: true,
				value: vi.fn(async () => {
					nativeFullscreen = null
					document.dispatchEvent(new Event("fullscreenchange"))
				}),
			})
			fireEvent.click(screen.getByText("next page"))
			await act(async () => {
				fireEvent.click(screen.getByText("toggle presentation"))
			})
			act(() => {
				testState.isMobile = false
				view.rerender(<ResponsiveRoute />)
			})
			expect(screen.getByTestId("preview-render")).toHaveAttribute(
				"data-presentation",
				"true",
			)
			await act(async () => {
				if (exitMode === "native browser exit") {
					nativeFullscreen = null
					document.dispatchEvent(new Event("fullscreenchange"))
				} else fireEvent.click(screen.getByText("toggle presentation"))
			})
			expect(screen.getByTestId("magic-popup")).toBeInTheDocument()
			expect(screen.getByTestId("preview-render")).toBe(preview)
			expect(preview).toHaveAttribute("data-presentation", "false")
			expect(preview).toHaveAttribute("data-page", "2")
			expect(testState.renderUnmounted).not.toHaveBeenCalled()
			expect(onClose).not.toHaveBeenCalled()
			fireEvent.click(screen.getByText("close preview"))
			expect(screen.getByText("desktop route")).toBeInTheDocument()
			expect(onClose).toHaveBeenCalledTimes(1)
		},
	)

	it("releases mobile layout when navigating away from an open preview", async () => {
		testState.isMobile = true
		const popupRef = createRef<PreviewDetailPopupRef>()
		const view = render(<PreviewDetailPopup ref={popupRef} setUserSelectDetail={vi.fn()} />)
		await openPreview(popupRef)
		testState.isMobile = false
		view.unmount()
		function Route() {
			return <span>{useIsMobile() ? "mobile route" : "desktop route"}</span>
		}
		render(<Route />)
		expect(screen.getByText("desktop route")).toBeInTheDocument()
	})
	it("preserves the share header offset after migrating the container styles", () => {
		const { rerender } = render(
			<PreviewDetailPopup isFileShare setUserSelectDetail={vi.fn()} />,
		)

		expect(screen.getByTestId("share-preview-detail-popup-root")).toHaveClass("mt-[52px]")
		expect(screen.getByTestId("share-preview-detail-popup-root")).toHaveClass(
			"h-[calc(100%_-_52px)]",
		)

		rerender(<PreviewDetailPopup isFileShare hideHeader setUserSelectDetail={vi.fn()} />)

		expect(screen.getByTestId("share-preview-detail-popup-root")).not.toHaveClass("mt-[52px]")
		expect(screen.getByTestId("share-preview-detail-popup-root")).toHaveClass("h-full")
	})

	it("expands the desktop modal shell with the preview fullscreen state", async () => {
		const popupRef = createRef<PreviewDetailPopupRef>()
		render(<PreviewDetailPopup ref={popupRef} setUserSelectDetail={vi.fn()} />)
		await openPreview(popupRef)

		expect(screen.getByTestId("magic-modal").className).toContain("!w-[80vw]")
		expect(screen.getByTestId("magic-modal").className).not.toContain("!h-[100dvh]")
		expect(screen.getByTestId("preview-render")).toHaveAttribute("data-fullscreen", "false")

		await act(async () => {
			fireEvent.click(screen.getByTestId("preview-fullscreen"))
		})

		const modal = screen.getByTestId("magic-modal")
		expect(modal.className).toContain("!top-0")
		expect(modal.className).toContain("!h-[100dvh]")
		expect(modal.className).toContain("!w-screen")
		expect(modal.getAttribute("data-content-class")).toContain("!h-[100dvh]")
		expect(modal.getAttribute("data-body-class")).toContain("!h-full")
		expect(modal).toHaveAttribute("data-centered", "false")
		expect(modal).toHaveAttribute("data-closable", "false")
		expect(screen.queryByTestId("magic-modal-title")).not.toBeInTheDocument()
		expect(screen.getByTestId("preview-render")).toHaveAttribute("data-fullscreen", "true")

		await act(async () => {
			fireEvent.click(screen.getByTestId("preview-fullscreen"))
		})
		expect(screen.getByTestId("magic-modal").className).not.toContain("!h-[100dvh]")
		expect(screen.getByTestId("preview-render")).toHaveAttribute("data-fullscreen", "false")
	})

	it("uses Escape to leave fullscreen without closing the popup", async () => {
		const popupRef = createRef<PreviewDetailPopupRef>()
		render(<PreviewDetailPopup ref={popupRef} setUserSelectDetail={vi.fn()} />)
		await openPreview(popupRef)

		await act(async () => {
			fireEvent.click(screen.getByTestId("preview-fullscreen"))
		})
		fireEvent.keyDown(document, { key: "Escape" })

		expect(screen.getByTestId("magic-modal")).toBeInTheDocument()
		expect(screen.getByTestId("preview-render")).toHaveAttribute("data-fullscreen", "false")
	})

	it("clears fullscreen state when closing and reopening the preview", async () => {
		const popupRef = createRef<PreviewDetailPopupRef>()
		render(<PreviewDetailPopup ref={popupRef} setUserSelectDetail={vi.fn()} />)
		await openPreview(popupRef)

		await act(async () => {
			fireEvent.click(screen.getByTestId("preview-fullscreen"))
			fireEvent.click(screen.getByTestId("magic-modal-cancel"))
		})
		expect(screen.queryByTestId("magic-modal")).not.toBeInTheDocument()

		await openPreview(popupRef)
		expect(screen.getByTestId("magic-modal").className).not.toContain("!h-[100dvh]")
		expect(screen.getByTestId("preview-render")).toHaveAttribute("data-fullscreen", "false")
	})

	it("updates attachment context after a preview has already opened", async () => {
		const popupRef = createRef<PreviewDetailPopupRef>()
		render(<PreviewDetailPopup ref={popupRef} setUserSelectDetail={vi.fn()} />)
		await openPreview(popupRef)

		expect(screen.getByTestId("preview-render")).toHaveAttribute("data-attachment-count", "0")

		await act(async () => {
			popupRef.current?.updateAttachments(
				[],
				[
					{
						file_id: "mock-file-context",
						file_name: "mock-file-context.ts",
						file_extension: "ts",
					},
				],
			)
		})

		expect(screen.getByTestId("preview-render")).toHaveAttribute("data-attachment-count", "1")
	})
})
