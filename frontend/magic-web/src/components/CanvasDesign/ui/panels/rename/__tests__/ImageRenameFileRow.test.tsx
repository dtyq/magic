import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ImageElement } from "../../../../runtime/document/types"
import type { ImageRenameRow } from "../useImageRename"
import ImageRenameFileRow from "../ImageRenameFileRow"

vi.mock("@/components/CanvasDesign/app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({
		t: (key: string, options?: string | { defaultValue?: string; number?: number }) => {
			if (typeof options === "string") return options
			return (options?.defaultValue ?? key).replace(
				"{{number}}",
				String(options?.number ?? ""),
			)
		},
	}),
}))

vi.mock("@/components/CanvasDesign/app/hooks/resources/useReferenceImageUrls", () => ({
	useReferenceImageUrls: () => ({ isLoading: false, lowUrl: undefined }),
}))

vi.mock("../RenameNameField", () => ({
	default: ({ label, value }: { label: string; value: string }) => (
		<textarea aria-label={label} value={value} readOnly />
	),
}))

function createRow(): ImageRenameRow {
	return {
		content: { contentId: "version-1", src: "" },
		version: 1,
		file: { fileId: "file-1", fileName: "image.png" },
		name: "image.png",
		shared: false,
		processing: false,
	} as ImageRenameRow
}

function createElement(): ImageElement {
	return {
		activeContentId: "version-1",
		mainContentId: "version-1",
	} as ImageElement
}

describe("ImageRenameFileRow", () => {
	afterEach(cleanup)

	it("uses the full row width and moves version badges onto the thumbnail", () => {
		render(
			<ImageRenameFileRow
				row={createRow()}
				element={createElement()}
				saving={false}
				onChange={vi.fn()}
			/>,
		)

		const row = screen.getByTestId("rename-file-row")
		const thumbnail = screen.getByTestId("rename-file-thumbnail")
		expect(row).not.toHaveClass("px-3")
		expect(screen.queryByText("V1")).toBeNull()
		expect(screen.queryByText("文件名")).toBeNull()
		expect(within(thumbnail).getByText("主版本")).toBeInTheDocument()
		expect(within(thumbnail).getByText("当前")).toBeInTheDocument()
		expect(screen.getByRole("textbox", { name: "第 1 版文件名" })).toHaveValue("image")
	})
})
