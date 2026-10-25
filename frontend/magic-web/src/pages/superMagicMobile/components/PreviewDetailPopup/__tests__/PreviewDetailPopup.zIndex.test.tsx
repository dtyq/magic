import { render, screen, act } from "@testing-library/react"
import { createRef, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PreviewDetailPopup, { type PreviewDetailPopupRef } from "../index"
import {
	acquireOverlayZIndex,
	resetOverlayStackForTest,
} from "@/utils/overlayZIndex/overlayStackManager"
import { DetailType } from "@/pages/superMagic/components/Detail/types"
import { useCurrentOverlayZIndex } from "@/utils/overlayZIndex"

const testState = vi.hoisted(() => ({
	isMobile: false,
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => testState.isMobile,
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
		}),
	}
})

vi.mock("react-router", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-router")>()
	return {
		...actual,
		useLocation: () => ({
			pathname: "/super-magic",
			search: "",
		}),
		useMatch: () => null,
	}
})

vi.mock("@/pages/superMagic/components/Detail/hooks/useDetailActions", () => ({
	useDetailActions: () => ({
		isFullscreen: false,
		setIsFullscreen: vi.fn(),
		isFromNode: false,
		handlePrevious: vi.fn(),
		handleNext: vi.fn(),
		handleFullscreen: vi.fn(),
		handleDownload: vi.fn(),
		allFiles: [],
		currentIndex: 0,
		effectiveAttachments: [],
	}),
}))

vi.mock("@/pages/superMagic/components/Detail/components/FilesViewer/utils/preview", () => ({
	correctDetailType: (detail: unknown) => detail,
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: ({
		children,
		open,
		zIndex,
		afterClose,
		onCancel,
	}: {
		children: ReactNode
		open?: boolean
		zIndex?: number
		afterClose?: () => void
		onCancel?: () => void
	}) =>
		open ? (
			<div data-testid="magic-modal" data-z-index={zIndex} style={{ zIndex }}>
				<button
					type="button"
					data-testid="magic-modal-cancel"
					onClick={() => {
						onCancel?.()
						afterClose?.()
					}}
				/>
				{children}
			</div>
		) : null,
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({
		children,
		visible,
		zIndex,
		zIndexManaged,
		onAnimationEnd,
		onClose,
	}: {
		children: ReactNode
		visible?: boolean
		zIndex?: number
		zIndexManaged?: boolean
		onAnimationEnd?: (open: boolean) => void
		onClose?: () => void
	}) =>
		visible ? (
			<div
				data-testid="magic-popup"
				data-z-index={zIndex}
				data-z-index-managed={String(zIndexManaged)}
				style={{ zIndex }}
			>
				<button
					type="button"
					data-testid="magic-popup-close"
					onClick={() => {
						onClose?.()
						onAnimationEnd?.(false)
					}}
				/>
				{children}
			</div>
		) : null,
}))

function TestChild() {
	const currentZIndex = useCurrentOverlayZIndex()
	return <div data-testid="test-child" data-current-zindex={currentZIndex ?? "none"} />
}

vi.mock("@/pages/superMagic/components/Detail/Render", () => ({
	default: () => <TestChild />,
}))

describe("PreviewDetailPopup - z-index isolation and stacking", () => {
	beforeEach(() => {
		resetOverlayStackForTest()
		testState.isMobile = false
	})

	it("allocates dynamic z-index (1010) and provides OverlayZIndexContext to children on desktop", async () => {
		const ref = createRef<PreviewDetailPopupRef>()

		render(<PreviewDetailPopup ref={ref} allowEdit={true} />)

		act(() => {
			ref.current?.open(
				{
					type: DetailType.Html,
					title: "test.html",
				} as never,
				[],
				[],
			)
		})

		const child = await screen.findByTestId("test-child")
		expect(child).toHaveAttribute("data-current-zindex", "1010")

		const modal = screen.getByTestId("magic-modal")
		expect(modal).toBeTruthy()
		expect(modal.getAttribute("data-z-index")).toBe("1010")
	})

	it("stacks a second preview modal at higher z-index (1020) when opening link preview", async () => {
		const ref1 = createRef<PreviewDetailPopupRef>()
		const ref2 = createRef<PreviewDetailPopupRef>()

		render(
			<>
				<PreviewDetailPopup ref={ref1} allowEdit={true} />
				<PreviewDetailPopup ref={ref2} allowEdit={true} />
			</>,
		)

		act(() => {
			ref1.current?.open(
				{
					type: DetailType.Html,
					title: "first.html",
				} as never,
				[],
				[],
			)
		})

		act(() => {
			ref2.current?.open(
				{
					type: DetailType.Html,
					title: "second.html",
				} as never,
				[],
				[],
			)
		})

		const modals = screen.getAllByTestId("magic-modal")
		expect(modals.length).toBe(2)
		expect(modals[0].getAttribute("data-z-index")).toBe("1010")
		expect(modals[1].getAttribute("data-z-index")).toBe("1020")
	})

	it("allocates dynamic z-index (1010) to MagicPopup on mobile", async () => {
		testState.isMobile = true
		const ref = createRef<PreviewDetailPopupRef>()

		render(<PreviewDetailPopup ref={ref} allowEdit={true} />)

		act(() => {
			ref.current?.open(
				{
					type: DetailType.Html,
					title: "mobile.html",
				} as never,
				[],
				[],
			)
		})

		const child = await screen.findByTestId("test-child")
		expect(child).toHaveAttribute("data-current-zindex", "1010")

		const popup = screen.getByTestId("magic-popup")
		expect(popup).toBeTruthy()
		expect(popup.getAttribute("data-z-index")).toBe("1010")
		expect(popup.getAttribute("data-z-index-managed")).toBe("false")
	})

	it("releases the overlay stack after the desktop preview closes", async () => {
		const ref = createRef<PreviewDetailPopupRef>()

		render(<PreviewDetailPopup ref={ref} allowEdit={true} />)

		act(() => {
			ref.current?.open(
				{
					type: DetailType.Html,
					title: "test.html",
				} as never,
				[],
				[],
			)
		})

		await screen.findByTestId("magic-modal")

		act(() => {
			screen.getByTestId("magic-modal-cancel").click()
		})

		const next = acquireOverlayZIndex({ scope: "global" })
		expect(next.overlayZIndex).toBe(1010)
		next.release()
	})

	it("releases the overlay stack after the mobile preview closes", async () => {
		testState.isMobile = true
		const ref = createRef<PreviewDetailPopupRef>()

		render(<PreviewDetailPopup ref={ref} allowEdit={true} />)

		act(() => {
			ref.current?.open(
				{
					type: DetailType.Html,
					title: "mobile.html",
				} as never,
				[],
				[],
			)
		})

		await screen.findByTestId("magic-popup")

		act(() => {
			screen.getByTestId("magic-popup-close").click()
		})

		const next = acquireOverlayZIndex({ scope: "global" })
		expect(next.overlayZIndex).toBe(1010)
		next.release()
	})
})
