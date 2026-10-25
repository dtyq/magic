import { forwardRef, useImperativeHandle } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactElement } from "react"
import { createTestStore, wrapWithStore } from "../../__tests__/testStoreHelpers"
import type { SelfMediaPost } from "../../types"
import WechatOfficialShell from "./WechatOfficialShell"

const {
	clipboardItemPayloads,
	clipboardWriteMock,
	copyArticleRichContentMock,
	getArticleHtmlMock,
	loadWechatArticleHtmlMock,
	toastErrorMock,
	toastSuccessMock,
} = vi.hoisted(() => ({
	clipboardItemPayloads: [] as Array<Record<string, Blob | Promise<Blob>>>,
	clipboardWriteMock: vi.fn(),
	copyArticleRichContentMock: vi.fn(() => false),
	getArticleHtmlMock: vi.fn(() => Promise.resolve<string | null>(null)),
	loadWechatArticleHtmlMock: vi.fn(() =>
		Promise.resolve({
			content:
				'<html><head><style>.fallback{color:red;font-weight:700}</style></head><body><section class="fallback">fallback html</section></body></html>',
			filePathMapping: new Map(),
		}),
	),
	toastErrorMock: vi.fn(),
	toastSuccessMock: vi.fn(),
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		error: toastErrorMock,
		success: toastSuccessMock,
	},
}))

vi.mock("@/assets/locales/locale-adapters", () => ({
	getAdminLocaleModules: () => ({}),
	getLocaleModules: () => ({}),
	loadFallbackLocale: () => Promise.resolve({ default: {} }),
	loadMagicFlowLocale: () => Promise.resolve({ default: {} }),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
	initReactI18next: { type: "3rdParty", init: () => undefined },
}))

vi.mock("../../components/SelfMediaShellHeader", () => ({
	__esModule: true,
	default: ({ onOpenExport }: { onOpenExport?: () => void }) => (
		<button type="button" data-testid="open-wechat-export" onClick={onOpenExport} />
	),
	SelfMediaShellViewBar: () => null,
}))

vi.mock("../../components/ExportPreviewDialog", () => ({
	__esModule: true,
	default: ({
		isCopyingWechatHtml,
		onCopyWechatHtml,
		open,
	}: {
		isCopyingWechatHtml?: boolean
		onCopyWechatHtml?: () => Promise<void>
		open: boolean
	}) =>
		open ? (
			<button
				type="button"
				data-testid="copy-wechat-html"
				disabled={isCopyingWechatHtml}
				onClick={() => void onCopyWechatHtml?.()}
			/>
		) : null,
}))

vi.mock("../../hooks/useExportProgressToast", () => ({
	useExportProgressToast: vi.fn(),
}))

vi.mock("../../hooks/useExportZip", () => ({
	useExportZip: () => ({
		exportWechatCoverImage: vi.fn(),
		progress: { current: 0, status: "idle", total: 0 },
	}),
}))

vi.mock("../../hooks/useShellFileHandlers", () => ({
	useShellFileHandlers: () => ({ handleAddFileToCurrentChat: vi.fn() }),
}))

vi.mock("./WechatCoverPhonePanel", () => ({ WechatCoverPhonePanel: () => null }))
vi.mock("./WechatOfficialContentGate", () => ({
	WechatOfficialContentGate: ({ children }: { children?: ReactElement }) => children,
}))
vi.mock("./edit", () => ({ __esModule: true, default: () => null }))
vi.mock("./code", () => ({ __esModule: true, default: () => null }))

vi.mock("./article", () => ({
	__esModule: true,
	default: forwardRef(function MockWechatArticle(_props, ref) {
		useImperativeHandle(ref, () => ({
			copyArticleRichContent: copyArticleRichContentMock,
			getArticleHtml: getArticleHtmlMock,
			getIframeElement: () => null,
			startInspector: vi.fn(),
			startInspectorAppend: vi.fn(),
			stopInspector: vi.fn(),
		}))
		return <div data-testid="mock-wechat-article" />
	}),
}))

vi.mock("./wechatArticleHtml", () => ({
	loadWechatArticleHtml: loadWechatArticleHtmlMock,
}))

const post: SelfMediaPost = {
	meta: { id: "wechat-post-1", title: "公众号文章" },
	cards: [],
	article: { path: "article.html", fileId: "article-file-1" },
}

function renderShell(): void {
	const store = createTestStore({
		platform: "wechat-official-accounts",
		posts: [post],
		view: "detail",
	})
	render(
		wrapWithStore(
			store,
			<WechatOfficialShell
				platform="wechat-official-accounts"
				attachmentList={[]}
				allowEdit
			/>,
		),
	)
}

describe("WechatOfficialShell clipboard export", () => {
	beforeEach(() => {
		class MockBlob {
			readonly parts: unknown[]
			readonly type: string

			constructor(parts: unknown[], options?: { type?: string }) {
				this.parts = parts
				this.type = options?.type || ""
			}
		}
		class MockClipboardItem {
			constructor(items: Record<string, Blob | Promise<Blob>>) {
				clipboardItemPayloads.push(items)
			}
		}

		vi.stubGlobal("Blob", MockBlob as unknown as typeof Blob)
		vi.stubGlobal("ClipboardItem", MockClipboardItem)
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { write: clipboardWriteMock },
		})
		clipboardWriteMock.mockImplementation(async () => {
			const payload = clipboardItemPayloads.at(-1)
			if (payload) await Promise.all(Object.values(payload))
		})
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.unstubAllGlobals()
		clipboardItemPayloads.length = 0
		clipboardWriteMock.mockReset()
		copyArticleRichContentMock.mockReset()
		copyArticleRichContentMock.mockReturnValue(false)
		getArticleHtmlMock.mockReset()
		getArticleHtmlMock.mockResolvedValue(null)
		loadWechatArticleHtmlMock.mockReset()
		loadWechatArticleHtmlMock.mockResolvedValue({
			content:
				'<html><head><style>.fallback{color:red;font-weight:700}</style></head><body><section class="fallback">fallback html</section></body></html>',
			filePathMapping: new Map(),
		})
		toastErrorMock.mockReset()
		toastSuccessMock.mockReset()
	})

	it("starts the clipboard write before async source conversion finishes", async () => {
		let resolveArticleHtml:
			| ((value: { content: string; filePathMapping: Map<never, never> }) => void)
			| null = null
		loadWechatArticleHtmlMock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveArticleHtml = resolve
				}),
		)
		renderShell()
		fireEvent.click(screen.getByTestId("open-wechat-export"))
		fireEvent.click(await screen.findByTestId("copy-wechat-html"))

		expect(clipboardWriteMock).toHaveBeenCalledTimes(1)
		expect(Object.keys(clipboardItemPayloads[0])).toEqual(["text/html", "text/plain"])

		await waitFor(() => expect(loadWechatArticleHtmlMock).toHaveBeenCalledTimes(1))
		resolveArticleHtml?.({
			content:
				'<html><head><style>.fallback{color:red;font-weight:700}</style></head><body><section class="fallback">fallback html</section></body></html>',
			filePathMapping: new Map(),
		})
		const htmlBlob = (await clipboardItemPayloads[0]["text/html"]) as unknown as {
			parts: string[]
		}
		const textBlob = (await clipboardItemPayloads[0]["text/plain"]) as unknown as {
			parts: string[]
		}
		expect(htmlBlob.parts[0]).toContain("color:rgb(255, 0, 0)")
		expect(textBlob.parts).toEqual(["fallback html"])
		await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledTimes(1))
	})

	it("uses native preview copy before the HTML fallback", async () => {
		copyArticleRichContentMock.mockReturnValueOnce(true)
		renderShell()
		fireEvent.click(screen.getByTestId("open-wechat-export"))
		fireEvent.click(await screen.findByTestId("copy-wechat-html"))

		await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledTimes(1))
		expect(getArticleHtmlMock).not.toHaveBeenCalled()
		expect(clipboardWriteMock).not.toHaveBeenCalled()
	})

	it("restores the copy button after a stylesheet request times out", async () => {
		vi.useFakeTimers()
		loadWechatArticleHtmlMock.mockResolvedValueOnce({
			content:
				'<html><head><link rel="stylesheet" href="https://cdn.example.com/article.css"></head><body><p>article</p></body></html>',
			filePathMapping: new Map(),
		})
		vi.stubGlobal(
			"fetch",
			vi.fn(
				(_url: string, init?: RequestInit) =>
					new Promise((_resolve, reject) => {
						init?.signal?.addEventListener("abort", () => {
							reject(new DOMException("Aborted", "AbortError"))
						})
					}),
			),
		)

		renderShell()
		fireEvent.click(screen.getByTestId("open-wechat-export"))
		const copyButton = screen.getByTestId("copy-wechat-html")
		fireEvent.click(copyButton)
		expect(copyButton).toBeDisabled()

		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
			await Promise.resolve()
		})
		await act(async () => {
			await vi.advanceTimersByTimeAsync(8_000)
		})

		expect(copyButton).not.toBeDisabled()
		expect(toastErrorMock).toHaveBeenCalledTimes(1)
		expect(toastSuccessMock).not.toHaveBeenCalled()
		expect(clipboardWriteMock).toHaveBeenCalledTimes(1)
	})
})
