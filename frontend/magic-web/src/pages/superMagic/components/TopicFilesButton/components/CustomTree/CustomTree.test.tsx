import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { TreeNodeData } from "../../utils/treeDataConverter"
import type { VisibleTreeNodeRow } from "../../utils/visibleTreeRows"
import { scrollFileRowIntoContainer } from "../../utils/scrollFileRowIntoContainer"
import CustomTree from "./CustomTree"

vi.mock("../../utils/scrollFileRowIntoContainer", () => ({
	scrollFileRowIntoContainer: vi.fn(() => true),
}))

vi.mock("@tanstack/react-virtual", () => ({
	useVirtualizer: () => ({
		getVirtualItems: () => [{ index: 55, key: "file-55", start: 1870 }],
		getTotalSize: () => 2040,
		measureElement: vi.fn(),
		scrollToIndex: vi.fn(),
		scrollToOffset: vi.fn(),
	}),
}))

vi.mock("./style", () => ({
	useStyles: () => ({ styles: { customTreeNode: "customTreeNode" } }),
}))

vi.mock("./useCustomTreePerf", () => ({
	measureTreeSelect: (_keys: unknown, _node: unknown, callback: () => void) => callback(),
	recordTreeScrollAnchorMissing: vi.fn(),
	recordTreeScrollAnchorRestore: vi.fn(),
	useCustomTreePerfMetrics: vi.fn(),
}))

function createRows(count: number): VisibleTreeNodeRow[] {
	return Array.from({ length: count }, (_, index) => {
		const node: TreeNodeData = {
			key: `file-${index}`,
			title: `File ${index}`,
			item: { file_id: `file-${index}`, file_name: `File ${index}` },
			level: 0,
			isLeaf: true,
		}

		return { node, parentNode: null, ancestorKeys: [] }
	})
}

describe("CustomTree virtualization", () => {
	it("uses the virtualizer's measured total size and row offset", () => {
		const visibleRows = createRows(60)
		const scrollElement = document.createElement("div")
		document.body.appendChild(scrollElement)

		const { container, unmount } = render(
			<CustomTree
				visibleRows={visibleRows}
				visibleNodes={visibleRows.map((row) => row.node)}
				visibleNodeIndexByKey={
					new Map(visibleRows.map((row, index) => [String(row.node.key), index]))
				}
				scrollElementRef={{ current: scrollElement }}
			/>,
		)

		expect(container.querySelector<HTMLElement>(".magic-tree")?.style.height).toBe("2040px")
		expect(container.querySelector<HTMLElement>('[data-index="55"]')?.style.transform).toBe(
			"translateY(1870px)",
		)

		unmount()
		scrollElement.remove()
	})

	it("scrolls a short tree inside the file list when locate asks for a row", () => {
		const visibleRows = createRows(3)
		const scrollElement = document.createElement("div")
		document.body.appendChild(scrollElement)
		vi.mocked(scrollFileRowIntoContainer).mockClear()

		const { unmount } = render(
			<CustomTree
				visibleRows={visibleRows}
				visibleNodes={visibleRows.map((row) => row.node)}
				visibleNodeIndexByKey={
					new Map(visibleRows.map((row, index) => [String(row.node.key), index]))
				}
				scrollElementRef={{ current: scrollElement }}
				scrollToKey="file-2"
			/>,
			{ container: scrollElement },
		)

		expect(scrollFileRowIntoContainer).toHaveBeenCalledWith(
			scrollElement,
			expect.any(HTMLElement),
		)
		expect(scrollElement.querySelector('[data-index="2"]')).toBeInstanceOf(HTMLElement)

		unmount()
		scrollElement.remove()
	})
})
