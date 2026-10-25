import { render, screen, waitFor } from "@testing-library/react"
import { forwardRef } from "react"
import { describe, expect, it, vi } from "vitest"
import { createTestStore, wrapWithStore } from "./testStoreHelpers"

const { mockGetTemporaryDownloadUrl } = vi.hoisted(() => ({
	mockGetTemporaryDownloadUrl: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: mockGetTemporaryDownloadUrl,
}))

vi.mock("../../../hooks/useEditMode", () => ({
	__esModule: true,
	default: () => ({
		isEditMode: true,
		setIsEditMode: vi.fn(),
	}),
}))

vi.mock("../platforms/rednote/RednoteEditThumbnailSidebar", () => ({
	RednoteEditThumbnailSidebar: () => <div data-testid="mock-thumbnail-sidebar" />,
}))

vi.mock("../platforms/rednote/RednoteEditRefreshConfirmDialog", () => ({
	RednoteEditRefreshConfirmDialog: () => null,
}))

vi.mock("@/pages/superMagic/components/Detail/components/EditToolbar/FileEditButtons", () => ({
	__esModule: true,
	default: () => <button type="button">save</button>,
}))

vi.mock("../../../contents/HTML/IsolatedHTMLRenderer", () => ({
	__esModule: true,
	default: forwardRef(function MockIsolatedHTMLRenderer(
		props: {
			scaleContentDimensions?: { width: number; height: number } | null
			toolbarClassName?: string
		},
		_ref,
	) {
		return (
			<div
				data-testid="mock-isolated-html-renderer"
				data-width={props.scaleContentDimensions?.width ?? ""}
				data-height={props.scaleContentDimensions?.height ?? ""}
				data-toolbar-class={props.toolbarClassName ?? ""}
			/>
		)
	}),
}))

import RednoteEditView from "../platforms/rednote/edit"

function renderEditView(platform: "rednote" | "instagram") {
	const store = createTestStore({
		platform,
		view: "edit",
		posts: [
			{
				meta: {
					id: "post-1",
					title: "Post 1",
				},
				cards: [{ path: "cards/01.html", fileId: "card-1" }],
			},
		],
	})

	mockGetTemporaryDownloadUrl.mockResolvedValue([{ url: "https://example.test/card.html" }])
	vi.spyOn(globalThis, "fetch").mockResolvedValue({
		ok: true,
		text: async () => "<html><body>card</body></html>",
	} as Response)

	render(wrapWithStore(store, <RednoteEditView attachmentList={[]} />))
}

describe("RednoteEditView scale dimensions", () => {
	it("passes rednote card dimensions to the isolated HTML renderer", async () => {
		renderEditView("rednote")

		const renderer = await screen.findByTestId("mock-isolated-html-renderer")
		expect(renderer).toHaveAttribute("data-width", "540")
		expect(renderer).toHaveAttribute("data-height", "720")
		expect(renderer.getAttribute("data-toolbar-class")).toContain("left-2")
		expect(renderer.getAttribute("data-toolbar-class")).not.toContain("left-1/2")
	})

	it("passes instagram card dimensions through the shared rednote editor", async () => {
		renderEditView("instagram")

		await waitFor(() => {
			const renderer = screen.getByTestId("mock-isolated-html-renderer")
			expect(renderer).toHaveAttribute("data-width", "540")
			expect(renderer).toHaveAttribute("data-height", "675")
		})
	})
})
