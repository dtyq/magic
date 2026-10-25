import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useIframeFS } from "../useIframeFS"
import { useIframeLLM } from "../useIframeLLM"

const download = vi.hoisted(() => vi.fn())
vi.mock("../../iframeApi", () => ({ getIframeDownloadUrl: download }))
function iframeRef(postMessage: ReturnType<typeof vi.fn>) {
	return { current: { contentWindow: { postMessage } } as unknown as HTMLIFrameElement }
}
afterEach(() => {
	vi.unstubAllGlobals()
	vi.useRealTimers()
})

describe("iframe document service lifecycle", () => {
	it("removes FS watches and drops late replies when the document changes", async () => {
		vi.useFakeTimers()
		const oldPost = vi.fn()
		const nextPost = vi.fn()
		const ref = iframeRef(oldPost)
		const uploadFn = vi.fn()
		const saveContentFn = vi.fn()
		const files = [{ file_id: "data", relative_file_path: "data.json" }]
		const { result, rerender } = renderHook(
			({ revision }) =>
				useIframeFS({
					iframeRef: ref,
					targetOrigin: "https://sandbox.example",
					runtimeRevision: revision,
					entryPath: "index.html",
					fileList: files,
					appConfig: null,
					uploadFn,
					saveContentFn,
				}),
			{ initialProps: { revision: "?page=1" } },
		)
		await act(async () => {
			await result.current.handleFSMessage("MAGIC_FS_WATCH_REGISTER", {
				requestId: "watch",
				path: "data.json",
			})
		})
		expect(vi.getTimerCount()).toBeGreaterThan(0)
		let finish: (value: Array<{ url: string }>) => void = () => undefined
		download.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve
				}),
		)
		const pending = result.current.handleFSMessage("MAGIC_FS_GET_FILE_URL_REQUEST", {
			requestId: "old-request",
			path: "data.json",
		})
		ref.current = iframeRef(nextPost).current
		rerender({ revision: "?page=2" })
		expect(vi.getTimerCount()).toBe(0)
		oldPost.mockClear()
		await act(async () => {
			finish([{ url: "old-url" }])
			await pending
		})
		expect(oldPost).not.toHaveBeenCalled()
		expect(nextPost).not.toHaveBeenCalled()
		download.mockResolvedValueOnce([{ url: "current-url" }])
		await act(async () => {
			await result.current.handleFSMessage("MAGIC_FS_GET_FILE_URL_REQUEST", {
				requestId: "current-request",
				path: "data.json",
			})
		})
		expect(nextPost).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: "current-request",
				success: true,
				url: "current-url",
			}),
			"https://sandbox.example",
		)
	})

	it("drops an old LLM response and replies to the new document after navigation", async () => {
		const oldPost = vi.fn()
		const nextPost = vi.fn()
		const ref = iframeRef(oldPost)
		const authorization = () => "token"
		const organization = () => "org"
		let finish: (value: Response) => void = () => undefined
		const fetch = vi.fn().mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve
				}),
		)
		vi.stubGlobal("fetch", fetch)
		const { result, rerender } = renderHook(
			({ revision }) =>
				useIframeLLM({
					iframeRef: ref,
					targetOrigin: "https://sandbox.example",
					runtimeRevision: revision,
					baseUrl: "https://api.example",
					getAuthorization: authorization,
					getOrganizationCode: organization,
				}),
			{ initialProps: { revision: "?page=1" } },
		)
		const pending = result.current.handleLLMMessage("MAGIC_LLM_GET_MODELS_REQUEST", {
			requestId: "old-models",
		})
		ref.current = iframeRef(nextPost).current
		rerender({ revision: "?page=2" })
		await act(async () => {
			finish(new Response(JSON.stringify({ data: [{ id: "model" }] })))
			await pending
		})
		expect(oldPost).not.toHaveBeenCalled()
		expect(nextPost).not.toHaveBeenCalled()
		fetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: { api_key: "key" } })))
		fetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "model" }] })))
		await act(async () => {
			await result.current.handleLLMMessage("MAGIC_LLM_GET_MODELS_REQUEST", {
				requestId: "current-models",
			})
		})
		expect(nextPost).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "current-models", success: true }),
			"https://sandbox.example",
		)
	})
	it("keeps a pending LLM response through ordinary rerenders with new callback identities", async () => {
		const post = vi.fn()
		const ref = iframeRef(post)
		let finish: (value: Response) => void = () => undefined
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ data: { api_key: "key" } })))
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finish = resolve
					}),
			)
		vi.stubGlobal("fetch", fetch)
		const { result, rerender } = renderHook(() =>
			useIframeLLM({
				iframeRef: ref,
				targetOrigin: "https://sandbox.example",
				runtimeRevision: "same-window",
				baseUrl: "https://api.example",
				getAuthorization: () => "token",
				getOrganizationCode: () => "org",
				authorizePermission: async () => true,
			}),
		)
		const pending = result.current.handleLLMMessage("MAGIC_LLM_GET_MODELS_REQUEST", {
			requestId: "pending-models",
		})
		await act(async () => {
			await Promise.resolve()
			await Promise.resolve()
		})
		rerender()
		await act(async () => {
			finish(new Response(JSON.stringify({ data: [{ id: "model" }] })))
			await pending
		})
		expect(post).toHaveBeenCalledWith(
			expect.objectContaining({ requestId: "pending-models", success: true }),
			"https://sandbox.example",
		)
	})
})
