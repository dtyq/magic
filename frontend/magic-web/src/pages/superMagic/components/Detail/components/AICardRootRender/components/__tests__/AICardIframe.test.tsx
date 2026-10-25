import { render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import { FileAccessProvider } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { createShareFileAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import AICardIframe from "../AICardIframe"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const labels: Record<string, string> = {
				"detail.aiCard.detail.loadingCard": "Loading card",
			}
			return labels[key] || key
		},
	}),
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: vi.fn(),
}))

vi.mock("../../../../contents/HTML/htmlProcessor", () => ({
	processHtmlContent: vi.fn(async ({ content }: { content: string }) => ({
		processedContent: content,
		filePathMapping: new Map(),
	})),
}))

vi.mock("../../../../contents/HTML/utils/fetchInterceptor", () => ({
	injectFetchInterceptorScript: (content: string) => content,
}))

vi.mock("../../../../contents/HTML/IsolatedHTMLRenderer", async () => {
	const React = await vi.importActual<typeof import("react")>("react")

	function MockIsolatedHTMLRenderer({
		content,
		fileId,
		onRenderReady,
	}: {
		content: string
		fileId?: string
		onRenderReady?: () => void
	}) {
		React.useEffect(() => {
			onRenderReady?.()
		}, [onRenderReady])

		return (
			<div data-testid="isolated-html-renderer" data-file-id={fileId}>
				{content}
			</div>
		)
	}

	return {
		default: MockIsolatedHTMLRenderer,
	}
})

const mockFetch = vi.fn()

function createAttachmentList(overrides?: {
	currentUpdatedAt?: string
	unrelatedUpdatedAt?: string
}) {
	return [
		{
			file_id: "folder",
			is_directory: true,
			children: [
				{
					file_id: "current-html",
					file_name: "index.html",
					relative_file_path: "cards/latest/index.html",
					updated_at: overrides?.currentUpdatedAt ?? "2026-06-20T01:00:00Z",
				},
				{
					file_id: "unrelated-html",
					file_name: "other.html",
					relative_file_path: "cards/other.html",
					updated_at: overrides?.unrelatedUpdatedAt ?? "2026-06-20T01:00:00Z",
				},
			],
		},
	]
}

function renderIframe(overrides?: Partial<ComponentProps<typeof AICardIframe>>) {
	return render(
		<AICardIframe
			fileId="current-html"
			attachmentList={createAttachmentList()}
			showSkeleton={false}
			{...overrides}
		/>,
	)
}

describe("AICardIframe", () => {
	beforeEach(() => {
		vi.mocked(getTemporaryDownloadUrl).mockReset()
		mockFetch.mockReset()
		vi.stubGlobal("fetch", mockFetch)

		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue([
			{ url: "https://example.com/card.html" },
		])
		mockFetch.mockResolvedValue({
			ok: true,
			text: async () => "<html>card</html>",
		})
	})

	it("does not reload when only an unrelated attachment changes", async () => {
		const { rerender } = renderIframe()

		await waitFor(() => {
			expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
		})

		rerender(
			<AICardIframe
				fileId="current-html"
				attachmentList={createAttachmentList({
					unrelatedUpdatedAt: "2026-06-20T02:00:00Z",
				})}
				showSkeleton={false}
			/>,
		)

		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
	})

	it("reloads when the current html file changes", async () => {
		const { rerender } = renderIframe()

		await waitFor(() => {
			expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
		})

		rerender(
			<AICardIframe
				fileId="current-html"
				attachmentList={createAttachmentList({
					currentUpdatedAt: "2026-06-20T02:00:00Z",
				})}
				showSkeleton={false}
			/>,
		)

		await waitFor(() => {
			expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(2)
		})
	})

	it("binds the ambient share access to the card html request", async () => {
		const shareAccess = createShareFileAccess({
			token: "share-token",
			projectId: "share-project",
		})

		render(
			<FileAccessProvider value={shareAccess}>
				<AICardIframe
					fileId="current-html"
					attachmentList={createAttachmentList()}
					showSkeleton={false}
				/>
			</FileAccessProvider>,
		)

		// The share preview can only read the card html when the share identity is
		// forwarded; an unbound call fails closed on share routes.
		await waitFor(() => {
			expect(getTemporaryDownloadUrl).toHaveBeenCalledWith({
				file_ids: ["current-html"],
				access: shareAccess,
			})
		})
	})

	it("shows a centered loading state while the card html is loading", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			text: () =>
				new Promise<string>(() => {
					// Keep the card in loading state for this assertion.
				}),
		})

		renderIframe({ showSkeleton: true })

		const loadingState = await screen.findByTestId("ai-card-iframe-loading")
		expect(loadingState).toHaveTextContent("Loading card")
		expect(screen.getByTestId("ai-card-loading-icon")).toBeInTheDocument()
		expect(screen.getAllByTestId("ai-card-loading-sparkle")).toHaveLength(3)
		expect(screen.queryByText("🃏")).not.toBeInTheDocument()
	})
})
