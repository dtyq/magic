import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { I18nTexts } from "../../../../../i18n/types"
import { MentionItemType } from "../../../../../types"
import { CustomMentionIcon, renderMentionFileIcon, renderMentionFolderIcon } from "../render-utils"
import { renderMentionItemIcon } from "../../../../../renderers/shared/icon"

vi.mock("@/components/base/TSIcon", () => ({
	default: ({ type, size }: { type: string; size?: string | number }) => (
		<span data-testid="ts-icon" data-type={type} data-size={size} />
	),
}))

describe("CustomMentionIcon", () => {
	it("renders an img element with secure attributes when iconUrl is provided", () => {
		const { container } = render(
			<CustomMentionIcon
				icon="ts-doc-file"
				iconUrl="https://example.com/icon.png"
				platform="desktop"
			/>,
		)

		const img = container.querySelector("img")
		expect(img).not.toBeNull()
		expect(img?.getAttribute("src")).toBe("https://example.com/icon.png")
		expect(img?.getAttribute("alt")).toBe("")
		expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer")
	})

	it("falls back to TSIcon token when image fails to load", () => {
		const { container, queryByTestId } = render(
			<CustomMentionIcon
				icon="ts-api"
				iconUrl="https://example.com/broken.png"
				platform="desktop"
			/>,
		)

		const img = container.querySelector("img")
		expect(img).not.toBeNull()
		expect(queryByTestId("ts-icon")).toBeNull()

		// Simulate image loading failure
		if (img) fireEvent.error(img)

		const tsIcon = queryByTestId("ts-icon")
		expect(tsIcon).not.toBeNull()
		expect(tsIcon?.getAttribute("data-type")).toBe("ts-api")
	})

	it("falls back to DEFAULT_CUSTOM_MENTION_ICON (ts-doc-file) when token is missing or unknown", () => {
		const { container, queryByTestId } = render(<CustomMentionIcon platform="desktop" />)

		expect(container.querySelector("img")).toBeNull()
		const tsIcon = queryByTestId("ts-icon")
		expect(tsIcon).not.toBeNull()
		expect(tsIcon?.getAttribute("data-type")).toBe("ts-doc-file")
	})

	it("maps file-folder token to ts-folder", () => {
		const { queryByTestId } = render(
			<CustomMentionIcon icon="file-folder" platform="desktop" />,
		)

		const tsIcon = queryByTestId("ts-icon")
		expect(tsIcon?.getAttribute("data-type")).toBe("ts-folder")
	})
})

describe("renderMentionItemIcon routing for custom mentions", () => {
	it("routes custom mention item with iconUrl to CustomMentionIcon", () => {
		const icon = renderMentionItemIcon({
			item: {
				id: "custom-item",
				name: "Custom Item",
				type: MentionItemType.TEXT,
				icon: "ts-doc-file",
				iconUrl: "https://example.com/custom.png",
				metadata: { customMention: true, customMentionGroupId: "group-1" },
			},
			t: {} as I18nTexts,
			platform: "desktop",
		})

		const { container } = render(<>{icon}</>)
		const img = container.querySelector("img")
		expect(img?.getAttribute("src")).toBe("https://example.com/custom.png")
	})

	it("routes custom mention group with icon and metadata to CustomMentionIcon", () => {
		const icon = renderMentionItemIcon({
			item: {
				id: "custom-group",
				name: "Custom Group",
				type: MentionItemType.FOLDER,
				icon: "ts-folder",
				metadata: { customMentionGroup: true, customMentionGroupId: "custom-group" },
			},
			t: {} as I18nTexts,
			platform: "desktop",
		})

		const { queryByTestId } = render(<>{icon}</>)
		const tsIcon = queryByTestId("ts-icon")
		expect(tsIcon?.getAttribute("data-type")).toBe("ts-folder")
	})
})

describe("renderMentionFolderIcon routing for custom mention groups", () => {
	it("delegates custom mention group with icon to CustomMentionIcon", () => {
		const icon = renderMentionFolderIcon({
			item: {
				id: "custom-group-reports",
				name: "Business reports",
				type: MentionItemType.FOLDER,
				icon: "ts-attachment",
				metadata: {
					customMentionGroup: true,
					customMentionGroupId: "custom-group-reports",
				},
			},
			t: {} as I18nTexts,
			platform: "desktop",
		})

		const { queryByTestId } = render(<>{icon}</>)
		const tsIcon = queryByTestId("ts-icon")
		expect(tsIcon).not.toBeNull()
		expect(tsIcon?.getAttribute("data-type")).toBe("ts-attachment")
	})

	it("delegates custom mention group with iconUrl to CustomMentionIcon", () => {
		const icon = renderMentionFolderIcon({
			item: {
				id: "custom-group-charts",
				name: "Business charts",
				type: MentionItemType.FOLDER,
				icon: "ts-doc-file",
				iconUrl: "https://example.com/charts.png",
				metadata: {
					customMentionGroup: true,
					customMentionGroupId: "custom-group-charts",
					iconUrl: "https://example.com/charts.png",
				},
			},
			t: {} as I18nTexts,
			platform: "desktop",
		})

		const { container } = render(<>{icon}</>)
		const img = container.querySelector("img")
		expect(img?.getAttribute("src")).toBe("https://example.com/charts.png")
	})
})

describe("renderMentionFileIcon routing for custom mentions", () => {
	it("delegates custom mention item with iconUrl to CustomMentionIcon", () => {
		const icon = renderMentionFileIcon({
			item: {
				id: "custom-file-item",
				name: "Report File",
				type: MentionItemType.PROJECT_FILE,
				icon: "ts-doc-file",
				iconUrl: "https://example.com/file.png",
				metadata: { customMention: true },
			},
			t: {} as I18nTexts,
			platform: "desktop",
		})

		const { container } = render(<>{icon}</>)
		const img = container.querySelector("img")
		expect(img?.getAttribute("src")).toBe("https://example.com/file.png")
	})
})
