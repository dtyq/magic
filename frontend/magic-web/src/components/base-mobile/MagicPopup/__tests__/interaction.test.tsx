import { render, screen } from "@testing-library/react"
import * as React from "react"
import { X } from "lucide-react"
import { describe, expect, test, vi } from "vitest"

import MagicPopup from "../index"

vi.mock("@/hooks/useOverlayZIndex", () => ({
	useOverlayZIndex: () => ({
		overlayZIndex: 1010,
		contentZIndex: 1011,
		releaseOverlayZIndex: vi.fn(),
	}),
}))

vi.mock("../useIosBottomDrawerScrollLock", () => ({
	useIosBottomDrawerScrollLock: () => ({
		contentStyle: undefined,
		handleContentRef: vi.fn(),
	}),
}))

vi.mock("@/components/shadcn-ui/drawer", () => ({
	Drawer: ({
		children,
		handleOnly,
		dismissible,
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<div
			data-testid="drawer-root"
			data-handle-only={String(handleOnly)}
			data-dismissible={String(dismissible)}
		>
			{children}
		</div>
	),
	DrawerPortal: ({ children }: React.PropsWithChildren) => <>{children}</>,
	DrawerOverlay: (props: React.ComponentProps<"div">) => (
		<div data-slot="drawer-overlay" {...props} />
	),
	DrawerTitle: ({ children, ...props }: React.ComponentProps<"h2">) => (
		<h2 {...props}>{children}</h2>
	),
	DrawerHandle: ({ children, ...props }: React.ComponentProps<"div">) => (
		<div data-slot="drawer-handle" {...props}>
			{children}
		</div>
	),
}))

vi.mock("vaul", () => ({
	Drawer: {
		Content: React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
			function MockDrawerContent({ children, ...props }, ref) {
				return (
					<div ref={ref} data-slot="drawer-content" {...props}>
						{children}
					</div>
				)
			},
		),
	},
}))

describe("MagicPopup interaction contract", () => {
	test("bottom popup 默认只允许手柄拖拽关闭，同时保留 dismissible", () => {
		render(
			<MagicPopup visible title="sheet">
				<div>content</div>
			</MagicPopup>,
		)

		expect(screen.getByTestId("drawer-root")).toHaveAttribute("data-handle-only", "true")
		expect(screen.getByTestId("drawer-root")).toHaveAttribute("data-dismissible", "true")
		expect(
			screen.getByText("content").closest('[data-slot="drawer-content"]'),
		).toBeInTheDocument()
	})

	test("overlay uses faster mask fade durations than vaul default", () => {
		render(
			<MagicPopup visible title="sheet">
				<div>content</div>
			</MagicPopup>,
		)

		const overlay = document.querySelector('[data-slot="drawer-overlay"]')
		expect(overlay?.className).toContain("data-[state=open]:!duration-300")
		expect(overlay?.className).toContain("data-[state=closed]:!duration-200")
	})

	test("非 bottom 弹层不会默认启用仅手柄拖拽关闭", () => {
		render(
			<MagicPopup visible title="side-sheet" position="left">
				<div>content</div>
			</MagicPopup>,
		)

		expect(screen.getByTestId("drawer-root")).toHaveAttribute("data-handle-only", "false")
	})

	test("禁用遮罩关闭但保留 dismissible 时，默认手柄仍然显示", () => {
		render(
			<MagicPopup visible title="drag-only" maskClosable={false} dismissible>
				<div>content</div>
			</MagicPopup>,
		)

		expect(screen.getByTestId("drawer-root")).toHaveAttribute("data-dismissible", "true")
		expect(document.querySelectorAll('[data-slot="drawer-handle"]')).toHaveLength(1)
	})

	test("default handle 和 actionHeader 都会渲染真实 Handle 节点", () => {
		const { rerender } = render(
			<MagicPopup visible title="default-handle">
				<div>content</div>
			</MagicPopup>,
		)

		expect(document.querySelectorAll('[data-slot="drawer-handle"]')).toHaveLength(1)

		rerender(
			<MagicPopup
				visible
				title="action-header"
				headerVariant="actionHeader"
				headerTitle="Action Header"
			/>,
		)

		expect(document.querySelectorAll('[data-slot="drawer-handle"]')).toHaveLength(1)
	})

	test("actionHeader 操作图标统一使用 22px 和 2px 描边", () => {
		render(
			<MagicPopup
				visible
				title="action-header-icons"
				headerVariant="actionHeader"
				headerTitle="Action Header"
				headerLeadingAction={{
					icon: <X className="text-foreground" strokeWidth={1} />,
					ariaLabel: "close",
					onClick: vi.fn(),
				}}
			/>,
		)

		const svg = screen.getByLabelText("close").querySelector("svg")
		expect(svg?.getAttribute("class")).toContain("size-[22px]")
		expect(svg?.getAttribute("class")).not.toContain("size-5")
		expect(svg?.getAttribute("stroke-width")).toBe("2")
	})
})
