import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import MenuItem from "../index"
import { en } from "../../../i18n/locales/en"
import { zhCN } from "../../../i18n/locales/zh-CN"
import type { MentionItem } from "../../../types"
import { MentionItemType } from "../../../types"

vi.mock("../../../renderers/context", () => ({
	useMentionItemRenderer: () => ({
		renderIcon: () => null,
		renderTitleSuffix: () => null,
	}),
	useMentionItemRenderContextValue: () => undefined,
}))

vi.mock("@/styles/fonts/geist", () => ({
	default: () => undefined,
}))

describe("MenuItem enter action", () => {
	const baseItem: MentionItem = {
		id: "folder-1",
		type: MentionItemType.FOLDER,
		name: "Docs",
	}

	it("renders the Chinese enter action for selected folders", () => {
		render(<MenuItem item={baseItem} selected onClick={vi.fn()} t={zhCN} />)

		const trigger = screen.getByTestId("mention-panel-enter-folder-trigger")

		expect(trigger).toHaveTextContent("进入")
		expect(trigger?.className).toContain("bg-white")
		expect(trigger?.className).toContain("text-black")
	})

	it("renders the English enter action for items with children", () => {
		render(
			<MenuItem
				item={{ ...baseItem, type: MentionItemType.PROJECT_FILE, hasChildren: true }}
				onClick={vi.fn()}
				t={en}
			/>,
		)

		expect(screen.getByTestId("mention-panel-enter-folder-trigger")).toHaveTextContent("Enter")
	})

	it("does not apply the enter action to history delete items", () => {
		const onDelete = vi.fn()

		render(
			<MenuItem
				item={{ ...baseItem, tags: ["history"] }}
				selected
				onClick={vi.fn()}
				onDelete={onDelete}
				t={zhCN}
			/>,
		)

		expect(screen.queryByTestId("mention-panel-enter-folder-trigger")).not.toBeInTheDocument()
		expect(screen.getByRole("button")).toBeInTheDocument()
		expect(screen.getByRole("option")?.className).not.toContain("group/menu-item")
	})

	it("keeps the delete button visible for unselected history items", () => {
		render(
			<MenuItem
				item={{ ...baseItem, tags: ["history"] }}
				onClick={vi.fn()}
				onDelete={vi.fn()}
				t={zhCN}
			/>,
		)

		expect(screen.getByRole("button")?.className).toContain("opacity-100")
		expect(screen.getByRole("button")?.className).not.toContain("opacity-0")
	})
})
