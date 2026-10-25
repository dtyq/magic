import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ImageElement } from "../../../runtime/document/types"
import ContentVersionGrid from "./ContentVersionGrid"

vi.mock("../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({
		t: (key: string, fallback?: string | { defaultValue?: string; number?: number }) => {
			if (typeof fallback === "string") return fallback.replace("{{number}}", "1")
			return (fallback?.defaultValue ?? key).replace(
				"{{number}}",
				String(fallback?.number ?? ""),
			)
		},
	}),
}))

vi.mock("./ContentVersionMedia", () => ({
	default: () => <span data-testid="version-media" />,
}))

function createElement(): ImageElement {
	return {
		id: "image-1",
		type: "image",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		activeContentId: "version-2",
		mainContentId: "version-1",
		contents: [
			{ contentId: "version-1", src: "one.png", status: "completed" },
			{ contentId: "version-2", src: "two.png", status: "completed" },
			{ contentId: "version-3", src: "three.png", status: "completed" },
			{ contentId: "version-4", src: "four.png", status: "completed" },
		],
	}
}

describe("ContentVersionGrid", () => {
	const onSelect = vi.fn()
	const onDelete = vi.fn()
	const onSetMain = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("lists every Content as a card and marks the effective version", () => {
		render(
			<ContentVersionGrid
				element={createElement()}
				effectiveContentId="version-2"
				canDelete
				canSetMain
				onSelect={onSelect}
				onDelete={onDelete}
				onSetMain={onSetMain}
			/>,
		)

		expect(screen.getByRole("button", { name: "切换到 V2" })).toHaveAttribute(
			"aria-pressed",
			"true",
		)
		expect(screen.getByRole("button", { name: "切换到 V4" })).toHaveAttribute(
			"aria-pressed",
			"false",
		)
		expect(screen.getAllByTestId("version-media")).toHaveLength(4)
		expect(screen.queryByText("V1")).toBeNull()
		expect(screen.getByText("主版本")).toBeInTheDocument()

		fireEvent.click(screen.getByRole("button", { name: "切换到 V4" }))
		expect(onSelect).toHaveBeenCalledWith("version-4")
	})

	it("exposes per-card delete and set-main actions on hover-capable cards", () => {
		render(
			<ContentVersionGrid
				element={createElement()}
				effectiveContentId="version-2"
				canDelete
				canSetMain
				onSelect={onSelect}
				onDelete={onDelete}
				onSetMain={onSetMain}
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "将 V2 设为主版本" }))
		fireEvent.click(screen.getByRole("button", { name: "删除 V3" }))

		expect(onSetMain).toHaveBeenCalledWith("version-2")
		expect(onDelete).toHaveBeenCalledWith("version-3")
	})

	it("does not offer an unavailable Content as the main version", () => {
		const element = createElement()
		element.contents[1] = { contentId: "version-2", status: "pending" }

		render(
			<ContentVersionGrid
				element={element}
				effectiveContentId="version-2"
				canDelete
				canSetMain
				onSelect={onSelect}
				onDelete={onDelete}
				onSetMain={onSetMain}
			/>,
		)

		expect(screen.queryByRole("button", { name: "将 V2 设为主版本" })).toBeNull()
		expect(screen.getByRole("button", { name: "删除 V2" })).toBeInTheDocument()
	})
})
