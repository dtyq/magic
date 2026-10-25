import { act, render, screen, waitFor } from "@testing-library/react"
import { forwardRef, type Ref } from "react"
import { describe, expect, it, vi } from "vitest"

const { mockGetTemporaryDownloadUrl } = vi.hoisted(() => ({
	mockGetTemporaryDownloadUrl: vi.fn(),
}))

vi.mock("@dtyq/magic-admin", () => ({}))
vi.mock("@dtyq/magic-admin/components", () => ({}))
vi.mock("@dtyq/magic-admin/provider", () => ({}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
}))

vi.mock("@/pages/superMagic/components/Detail/components/EditToolbar/FileEditButtons", () => ({
	__esModule: true,
	default: () => (
		<div data-testid="wechat-edit-file-actions">
			<button type="button" data-testid="wechat-edit-save-button">
				save
			</button>
			<button type="button" data-testid="wechat-edit-cancel-button">
				cancel
			</button>
		</div>
	),
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

vi.mock("../platforms/rednote/RednoteEditRefreshConfirmDialog", () => ({
	RednoteEditRefreshConfirmDialog: () => null,
}))

vi.mock("../../../contents/HTML/IsolatedHTMLRenderer", () => ({
	__esModule: true,
	default: forwardRef(function MockIsolatedHTMLRenderer(
		{
			toolbarEndRef,
		}: {
			toolbarEndRef?: Ref<HTMLDivElement | null>
		},
		_ref,
	) {
		return (
			<div data-testid="mock-isolated-html-renderer">
				<div data-testid="html-style-panel-toolbar-end" ref={toolbarEndRef} />
			</div>
		)
	}),
}))

import WechatEditView from "../platforms/wechat-official-accounts/edit"

describe("WechatEditView toolbar", () => {
	it("renders save and cancel in the style toolbar end slot", async () => {
		mockGetTemporaryDownloadUrl.mockResolvedValue([
			{ url: "https://example.test/article.html" },
		])
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				text: async () => "<article>wechat article</article>",
			}),
		)

		render(
			<WechatEditView
				post={{
					meta: { id: "wechat-post-1", title: "Article" },
					cards: [],
					article: { fileId: "article-1" },
				}}
				onChangePost={vi.fn()}
			/>,
		)

		await screen.findByTestId("mock-isolated-html-renderer")

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "CONTENT_CHANGED",
						payload: { hasChanges: true },
					},
				}),
			)
		})

		await waitFor(() => {
			expect(
				screen
					.getByTestId("html-style-panel-toolbar-end")
					.querySelector("[data-testid='wechat-edit-file-actions']"),
			).toBeTruthy()
		})
		expect(screen.getByTestId("wechat-edit-save-button")).toBeInTheDocument()
		expect(screen.getByTestId("wechat-edit-cancel-button")).toBeInTheDocument()

		vi.unstubAllGlobals()
	})
})
