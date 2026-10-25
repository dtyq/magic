import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { TabItem as TabItemType } from "../../types"
import TabItem from "../TabItem"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("antd", () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/components/base/MagicIcon", () => ({ default: () => null }))
vi.mock("@/components/base/MagicLoadingIcon", () => ({ MagicLoadingIcon: () => null }))
vi.mock("../FileTabMagicIcon", () => ({ FileTabMagicIcon: () => null }))
vi.mock("@/pages/superMagic/components/MessageList/components/MessageAttachment/utils", () => ({
	isMagicProjectConfigFile: () => false,
}))
vi.mock("../../../../../MessageEditor/utils/drag", () => ({
	handleTabDragEnd: vi.fn(),
	handleTabDragStart: vi.fn(),
}))

function renderTab(closeable: boolean) {
	const tab: TabItemType = {
		id: "index",
		title: "index.html",
		fileData: { file_id: "index", file_name: "index.html" },
		active: true,
		closeable,
	}

	return render(
		<TabItem
			tab={tab}
			allTabs={[tab]}
			isActive
			isDragging={false}
			isPlayback={false}
			onSwitchToTab={vi.fn()}
			onCloseTab={vi.fn()}
		/>,
	)
}

describe("FilesViewer TabItem", () => {
	it("hides the close control for protected tabs", () => {
		renderTab(false)

		expect(screen.queryByTestId("handle-close")).not.toBeInTheDocument()
	})
})
