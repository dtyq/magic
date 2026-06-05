import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import MobileShellScaffold from "../MobileShellScaffold"

const DEFAULT_RECT = {
	width: 1000,
	height: 600,
	top: 0,
	left: 0,
	bottom: 600,
	right: 1000,
	x: 0,
	y: 0,
	toJSON: () => ({}),
}

vi.mock("@/models/config/hooks", () => ({
	useTheme: () => ({
		prefersColorScheme: "light",
	}),
}))

describe("MobileShellScaffold", () => {
	it("使用 relative h-full 布局而非 fixed，使 GlobalSafeArea spacer 能正常夹住内容", () => {
		render(
			<MobileShellScaffold
				isSidebarOpen={false}
				sidebar={<div>sidebar</div>}
				panel={<div>panel</div>}
				onOpenSidebar={vi.fn()}
				onCloseSidebar={vi.fn()}
			/>,
		)

		const root = screen.getByTestId("mobile-shell-root")
		expect(root.className).toContain("relative")
		expect(root.className).toContain("h-full")
		expect(root.className).toContain("w-full")
		expect(root.className).not.toContain("fixed")
		expect(root.className).not.toContain("h-screen")
		expect(root.className).not.toContain("w-screen")
	})

	it("侧栏关闭时轨道滑出视口左侧，主面板不偏移", () => {
		render(
			<MobileShellScaffold
				isSidebarOpen={false}
				sidebar={<div>sidebar</div>}
				panel={<div>panel</div>}
				onOpenSidebar={vi.fn()}
				onCloseSidebar={vi.fn()}
			/>,
		)

		const sidebar = screen.getByTestId("mobile-shell-sidebar")
		const panel = screen.getByTestId("mobile-shell-panel")

		expect(sidebar.className).toContain("-translate-x-full")
		expect(sidebar.className).not.toContain("translate-x-0")
		expect(sidebar.style.transition).toContain("0.35s")
		expect(sidebar.style.transition).toContain("cubic-bezier(0.4, 0, 0.2, 1)")
		expect(panel.className).toContain("translate-x-0")
		expect(panel.style.transition).toContain("0.35s")
		expect(panel.className).not.toContain("translate-x-[var(--mobile-shell-sidebar-width)]")
	})

	it("侧栏打开时轨道与主面板同步右移", () => {
		render(
			<MobileShellScaffold
				isSidebarOpen={true}
				sidebar={<div>sidebar</div>}
				panel={<div>panel</div>}
				onOpenSidebar={vi.fn()}
				onCloseSidebar={vi.fn()}
			/>,
		)

		const sidebar = screen.getByTestId("mobile-shell-sidebar")
		const panel = screen.getByTestId("mobile-shell-panel")

		expect(sidebar.className).toContain("translate-x-0")
		expect(sidebar.className).not.toContain("-translate-x-full")
		expect(panel.className).toContain("translate-x-[var(--mobile-shell-sidebar-width)]")
		expect(panel.style.transition).toMatch(/transform 0\.35s/)
		expect(panel.style.transition).toMatch(/box-shadow 0\.35s/)
	})

	it("右滑超过阈值时打开侧栏，并在拖动时主面板跟手移动", () => {
		const onOpenSidebar = vi.fn()
		render(
			<MobileShellScaffold
				isSidebarOpen={false}
				sidebar={<div>sidebar</div>}
				panel={<div>panel</div>}
				onOpenSidebar={onOpenSidebar}
				onCloseSidebar={vi.fn()}
			/>,
		)

		const root = screen.getByTestId("mobile-shell-root")
		const device = screen.getByTestId("mobile-shell-device")
		const panel = screen.getByTestId("mobile-shell-panel")

		vi.spyOn(root, "getBoundingClientRect").mockReturnValue(DEFAULT_RECT)

		fireEvent.touchStart(device, { touches: [{ clientX: 100, clientY: 100 }] })
		fireEvent.touchMove(device, { touches: [{ clientX: 500, clientY: 100 }] })
		expect(panel.style.transform).toBe("translateX(400px)")
		fireEvent.touchEnd(device, { changedTouches: [{ clientX: 500, clientY: 100 }] })

		expect(onOpenSidebar).toHaveBeenCalledTimes(1)
	})

	it("左滑超过阈值时关闭侧栏", () => {
		const onCloseSidebar = vi.fn()
		render(
			<MobileShellScaffold
				isSidebarOpen={true}
				sidebar={<div>sidebar</div>}
				panel={<div>panel</div>}
				onOpenSidebar={vi.fn()}
				onCloseSidebar={onCloseSidebar}
			/>,
		)

		const root = screen.getByTestId("mobile-shell-root")
		const device = screen.getByTestId("mobile-shell-device")

		vi.spyOn(root, "getBoundingClientRect").mockReturnValue(DEFAULT_RECT)

		fireEvent.touchStart(device, { touches: [{ clientX: 700, clientY: 100 }] })
		fireEvent.touchMove(device, { touches: [{ clientX: 300, clientY: 100 }] })
		fireEvent.touchEnd(device, { changedTouches: [{ clientX: 300, clientY: 100 }] })

		expect(onCloseSidebar).toHaveBeenCalledTimes(1)
	})

	it("未达阈值时回弹还原，不触发开关", () => {
		const onOpenSidebar = vi.fn()
		const dateNowSpy = vi.spyOn(Date, "now")
		dateNowSpy.mockReturnValueOnce(0).mockReturnValueOnce(1000)
		render(
			<MobileShellScaffold
				isSidebarOpen={false}
				sidebar={<div>sidebar</div>}
				panel={<div>panel</div>}
				onOpenSidebar={onOpenSidebar}
				onCloseSidebar={vi.fn()}
			/>,
		)

		const root = screen.getByTestId("mobile-shell-root")
		const device = screen.getByTestId("mobile-shell-device")

		vi.spyOn(root, "getBoundingClientRect").mockReturnValue(DEFAULT_RECT)

		fireEvent.touchStart(device, { touches: [{ clientX: 100, clientY: 100 }] })
		fireEvent.touchMove(device, { touches: [{ clientX: 130, clientY: 100 }] })
		fireEvent.touchEnd(device, { changedTouches: [{ clientX: 130, clientY: 100 }] })

		expect(onOpenSidebar).not.toHaveBeenCalled()
		dateNowSpy.mockRestore()
	})

	it("纵向滚动手势不触发侧栏开关", () => {
		const onOpenSidebar = vi.fn()
		render(
			<MobileShellScaffold
				isSidebarOpen={false}
				sidebar={<div>sidebar</div>}
				panel={<div>panel</div>}
				onOpenSidebar={onOpenSidebar}
				onCloseSidebar={vi.fn()}
			/>,
		)

		const root = screen.getByTestId("mobile-shell-root")
		const device = screen.getByTestId("mobile-shell-device")

		vi.spyOn(root, "getBoundingClientRect").mockReturnValue(DEFAULT_RECT)

		fireEvent.touchStart(device, { touches: [{ clientX: 100, clientY: 100 }] })
		fireEvent.touchMove(device, { touches: [{ clientX: 130, clientY: 190 }] })
		fireEvent.touchEnd(device, { changedTouches: [{ clientX: 130, clientY: 190 }] })

		expect(onOpenSidebar).not.toHaveBeenCalled()
	})

	it("touchcancel 只重置手势，不提交开关状态", () => {
		const onOpenSidebar = vi.fn()
		render(
			<MobileShellScaffold
				isSidebarOpen={false}
				sidebar={<div>sidebar</div>}
				panel={<div>panel</div>}
				onOpenSidebar={onOpenSidebar}
				onCloseSidebar={vi.fn()}
			/>,
		)

		const root = screen.getByTestId("mobile-shell-root")
		const device = screen.getByTestId("mobile-shell-device")
		vi.spyOn(root, "getBoundingClientRect").mockReturnValue(DEFAULT_RECT)

		fireEvent.touchStart(device, { touches: [{ clientX: 100, clientY: 100 }] })
		fireEvent.touchMove(device, { touches: [{ clientX: 600, clientY: 100 }] })
		fireEvent.touchCancel(device)

		expect(onOpenSidebar).not.toHaveBeenCalled()
	})

	it("关闭态非边缘右滑同样可以触发打开", () => {
		const onOpenSidebar = vi.fn()
		render(
			<MobileShellScaffold
				isSidebarOpen={false}
				sidebar={<div>sidebar</div>}
				panel={<div>panel</div>}
				onOpenSidebar={onOpenSidebar}
				onCloseSidebar={vi.fn()}
			/>,
		)

		const root = screen.getByTestId("mobile-shell-root")
		const device = screen.getByTestId("mobile-shell-device")
		vi.spyOn(root, "getBoundingClientRect").mockReturnValue(DEFAULT_RECT)

		fireEvent.touchStart(device, { touches: [{ clientX: 120, clientY: 100 }] })
		fireEvent.touchMove(device, { touches: [{ clientX: 620, clientY: 100 }] })
		fireEvent.touchEnd(device, { changedTouches: [{ clientX: 620, clientY: 100 }] })

		expect(onOpenSidebar).toHaveBeenCalledTimes(1)
	})

	it("嵌套壳层时仅内层响应手势，避免双侧栏同时出现", () => {
		const outerOpen = vi.fn()
		const innerOpen = vi.fn()
		render(
			<MobileShellScaffold
				isSidebarOpen={false}
				sidebar={<div>outer-sidebar</div>}
				onOpenSidebar={outerOpen}
				onCloseSidebar={vi.fn()}
				panel={
					<MobileShellScaffold
						isSidebarOpen={false}
						sidebar={<div>inner-sidebar</div>}
						panel={<div>inner-panel</div>}
						onOpenSidebar={innerOpen}
						onCloseSidebar={vi.fn()}
						testIdPrefix="inner-shell"
					/>
				}
				testIdPrefix="outer-shell"
			/>,
		)

		const outerRoot = screen.getByTestId("outer-shell-root")
		const innerRoot = screen.getByTestId("inner-shell-root")
		const innerDevice = screen.getByTestId("inner-shell-device")
		vi.spyOn(outerRoot, "getBoundingClientRect").mockReturnValue(DEFAULT_RECT)
		vi.spyOn(innerRoot, "getBoundingClientRect").mockReturnValue(DEFAULT_RECT)

		fireEvent.touchStart(innerDevice, { touches: [{ clientX: 10, clientY: 100 }] })
		fireEvent.touchMove(innerDevice, { touches: [{ clientX: 410, clientY: 100 }] })
		fireEvent.touchEnd(innerDevice, { changedTouches: [{ clientX: 410, clientY: 100 }] })

		expect(innerOpen).toHaveBeenCalledTimes(1)
		expect(outerOpen).not.toHaveBeenCalled()
	})

	it("触点命中侧滑行区域时不触发全局侧栏手势", () => {
		const onOpenSidebar = vi.fn()
		render(
			<MobileShellScaffold
				isSidebarOpen={false}
				sidebar={<div>sidebar</div>}
				panel={
					<div data-mobile-shell-swipe-guard="true" data-testid="swipe-guard-item">
						guard
					</div>
				}
				onOpenSidebar={onOpenSidebar}
				onCloseSidebar={vi.fn()}
			/>,
		)

		const root = screen.getByTestId("mobile-shell-root")
		const guard = screen.getByTestId("swipe-guard-item")
		vi.spyOn(root, "getBoundingClientRect").mockReturnValue(DEFAULT_RECT)

		fireEvent.touchStart(guard, { touches: [{ clientX: 100, clientY: 100 }] })
		fireEvent.touchMove(guard, { touches: [{ clientX: 600, clientY: 100 }] })
		fireEvent.touchEnd(guard, { changedTouches: [{ clientX: 600, clientY: 100 }] })

		expect(onOpenSidebar).not.toHaveBeenCalled()
	})
})
