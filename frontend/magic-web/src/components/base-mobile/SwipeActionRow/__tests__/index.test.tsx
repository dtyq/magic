import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SwipeActionRow, type SwipeAction } from "../index"

/** 构造最小 actions，便于断言位移宽度（2 × 64px） */
function createActions(): SwipeAction[] {
	return [
		{
			id: "more",
			label: "更多",
			icon: <span>⋯</span>,
			className: "bg-secondary",
			onClick: vi.fn(),
		},
		{
			id: "delete",
			label: "删除",
			icon: <span>×</span>,
			className: "bg-destructive",
			onClick: vi.fn(),
		},
	]
}

/** 从行容器取出内容层与操作层 DOM，供 transform 断言使用 */
function getRowLayers(testId: string) {
	const row = screen.getByTestId(testId)
	const contentLayer = row.children[0] as HTMLElement
	const actionLayer = row.children[1] as HTMLElement

	return { contentLayer, actionLayer }
}

describe("SwipeActionRow", () => {
	it("左滑接管后不向父层冒泡，避免触发外层壳手势", () => {
		const parentTouchStart = vi.fn()
		const parentTouchMove = vi.fn()
		const parentTouchEnd = vi.fn()
		render(
			<div
				onTouchStart={parentTouchStart}
				onTouchMove={parentTouchMove}
				onTouchEnd={parentTouchEnd}
			>
				<SwipeActionRow
					actions={createActions()}
					isOpen={false}
					onOpen={vi.fn()}
					onClose={vi.fn()}
					data-testid="swipe-row"
				>
					<div>行内容</div>
				</SwipeActionRow>
			</div>,
		)

		const row = screen.getByTestId("swipe-row")
		fireEvent.touchStart(row, { touches: [{ clientX: 100, clientY: 100 }] })
		fireEvent.touchMove(row, { touches: [{ clientX: 50, clientY: 100 }] })
		fireEvent.touchEnd(row)

		expect(parentTouchStart).toHaveBeenCalledTimes(1)
		expect(parentTouchMove).not.toHaveBeenCalled()
		expect(parentTouchEnd).not.toHaveBeenCalled()
	})

	it("关闭态右滑不由行内接管，事件可冒泡给外层菜单手势", () => {
		const parentTouchMove = vi.fn()
		const parentTouchEnd = vi.fn()
		render(
			<div onTouchMove={parentTouchMove} onTouchEnd={parentTouchEnd}>
				<SwipeActionRow
					actions={createActions()}
					isOpen={false}
					onOpen={vi.fn()}
					onClose={vi.fn()}
					data-testid="swipe-row"
				>
					<div>行内容</div>
				</SwipeActionRow>
			</div>,
		)

		const row = screen.getByTestId("swipe-row")
		fireEvent.touchStart(row, { touches: [{ clientX: 100, clientY: 100 }] })
		fireEvent.touchMove(row, { touches: [{ clientX: 180, clientY: 100 }] })
		fireEvent.touchEnd(row)

		expect(parentTouchMove).toHaveBeenCalled()
		expect(parentTouchEnd).toHaveBeenCalled()
	})

	it("关闭态用 calc(100% + 0px) 将操作层完全藏到右侧，避免露出竖线", () => {
		render(
			<SwipeActionRow
				actions={createActions()}
				isOpen={false}
				onOpen={vi.fn()}
				onClose={vi.fn()}
				data-testid="swipe-row"
			>
				<div>行内容</div>
			</SwipeActionRow>,
		)

		const { contentLayer, actionLayer } = getRowLayers("swipe-row")

		expect(contentLayer.style.transform).toBe("translateX(0px)")
		expect(actionLayer.style.transform).toBe("translateX(calc(100% + 0px))")
	})

	it("isOpen 变为 false 时同步将内容层位移回 0", async () => {
		const { rerender } = render(
			<SwipeActionRow
				actions={createActions()}
				isOpen={true}
				onOpen={vi.fn()}
				onClose={vi.fn()}
				data-testid="swipe-row"
			>
				<div>行内容</div>
			</SwipeActionRow>,
		)

		const { contentLayer } = getRowLayers("swipe-row")

		await waitFor(() => {
			expect(contentLayer.style.transform).toBe("translateX(-128px)")
		})

		rerender(
			<SwipeActionRow
				actions={createActions()}
				isOpen={false}
				onOpen={vi.fn()}
				onClose={vi.fn()}
				data-testid="swipe-row"
			>
				<div>行内容</div>
			</SwipeActionRow>,
		)

		await waitFor(() => {
			expect(contentLayer.style.transform).toBe("translateX(0px)")
		})
	})
})
