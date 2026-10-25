import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, it, vi } from "vitest"
import SlidesTemplateCanvasItemsLayer from "../SlidesTemplateCanvasItemsLayer"
import SlidesTemplateCanvasLoopColumn, {
	type SlidesTemplateCanvasColumnItem,
} from "../SlidesTemplateCanvasLoopColumn"
import { SLIDES_TEMPLATE_CANVAS_DEFAULT_ITEM_SIZE } from "../canvasLayout"
import { isCanvasDragBlockedTarget, type SlidesTemplateCanvasTile } from "../canvasInteraction"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: { language: "en_US" },
		t: (key: string) => key,
	}),
}))

function createColumnItem(index: number): SlidesTemplateCanvasColumnItem {
	const tile: SlidesTemplateCanvasTile = {
		id: `template-${index}:cover:${index}`,
		imageUrl: `https://example.com/template-${index}.png`,
		kind: "cover",
		template: {
			value: `template-${index}`,
			label: `Template ${index}`,
			preview_image_urls: [],
		},
	}

	return {
		visibleIndex: index,
		canvasItem: {
			index,
			grid: { x: 0, y: index },
			item: tile,
			position: { x: 0, y: index * 184 },
			size: SLIDES_TEMPLATE_CANVAS_DEFAULT_ITEM_SIZE,
			span: { columns: 1, rows: 1 },
		},
	}
}

function renderColumn(
	items: SlidesTemplateCanvasColumnItem[],
	isIdleAnimationActive: boolean,
	onTemplateSelect = vi.fn(),
	keepIdleLoopMountedWhenPaused = true,
) {
	return (
		<SlidesTemplateCanvasLoopColumn
			allItems={items.map(({ canvasItem }) => canvasItem)}
			focusedAnchorTileId=""
			idleLoop={{ column: 0, delay: 0, direction: -1, distance: 552, duration: 46 }}
			isCanvasFocusSettling={false}
			isCanvasMoving={false}
			isIdleAnimationActive={isIdleAnimationActive}
			keepIdleLoopMountedWhenPaused={keepIdleLoopMountedWhenPaused}
			items={items}
			onPreviewClick={vi.fn()}
			onTemplateSelect={onTemplateSelect}
			reduceMotion={false}
			selectedTemplateValue=""
			shouldPlayIntro={false}
		/>
	)
}

describe("SlidesTemplateCanvas idle transition", () => {
	it("removes column loop copies when filtered results disable idle loops", async () => {
		const items = [createColumnItem(0), createColumnItem(1), createColumnItem(2)]
		const canvasItems = items.map(({ canvasItem }) => canvasItem)
		const contentRef = createRef<HTMLDivElement>()
		const renderLayer = (enableIdleLoops: boolean) => (
			<SlidesTemplateCanvasItemsLayer
				canvasItems={canvasItems}
				contentRef={contentRef}
				enableIdleLoops={enableIdleLoops}
				focusedAnchorTileId=""
				guideAnchor={null}
				isCanvasFocusSettling={false}
				isCanvasMoving={false}
				isIdleAnimationActive
				keepIdleLoopsMounted
				prioritizeCoverLoading={false}
				selectedTemplateValue=""
				visibleCanvasItems={canvasItems}
				onPreviewClick={vi.fn()}
				onTemplateSelect={vi.fn()}
			/>
		)
		const view = render(renderLayer(true))

		await waitFor(() => {
			expect(screen.getAllByTestId("slides-template-loop-cover")).toHaveLength(6)
		})

		view.rerender(renderLayer(false))
		await waitFor(() => {
			expect(screen.queryByTestId("slides-template-loop-cover")).not.toBeInTheDocument()
		})
	})

	it("keeps one shared loop layer mounted and interactive while paused", async () => {
		const onTemplateSelect = vi.fn()
		const firstItem = createColumnItem(0)
		const secondItem = createColumnItem(1)
		const view = render(renderColumn([firstItem], true, onTemplateSelect))

		await waitFor(() => {
			expect(screen.getAllByTestId("slides-template-loop-cover")).toHaveLength(2)
		})

		view.rerender(renderColumn([firstItem, secondItem], false, onTemplateSelect))

		expect(screen.getAllByTestId("slides-template-loop-cover")).toHaveLength(4)
		const loopCover = screen.getAllByTestId("slides-template-loop-cover")[0]
		expect(isCanvasDragBlockedTarget(loopCover)).toBe(false)
		const selectButton = within(loopCover).getByTestId("slides-template-cover-select-button")
		expect(isCanvasDragBlockedTarget(selectButton)).toBe(true)
		fireEvent.click(selectButton)
		expect(onTemplateSelect).toHaveBeenCalledWith(firstItem.canvasItem.item.template)
	})

	it("unmounts paused loop covers when low-detail rendering is enabled", async () => {
		const firstItem = createColumnItem(0)
		const view = render(renderColumn([firstItem], true))

		await waitFor(() => {
			expect(screen.getAllByTestId("slides-template-loop-cover")).toHaveLength(2)
		})

		view.rerender(renderColumn([firstItem], false, vi.fn(), false))

		await waitFor(() => {
			expect(screen.queryByTestId("slides-template-loop-cover")).not.toBeInTheDocument()
		})
	})
})
