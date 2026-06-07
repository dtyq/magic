import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useIframeAgent } from "../useIframeAgent"
import { useIframeFS } from "../useIframeFS"
import { useIframeLLM } from "../useIframeLLM"

function makeIframeRef(postMessage = vi.fn()) {
	return {
		current: {
			contentWindow: { postMessage },
		} as unknown as HTMLIFrameElement,
	}
}

const targetOrigin = "https://sandbox.example.com"

describe("iframe API target origin", () => {
	let originalFetch: typeof globalThis.fetch

	beforeEach(() => {
		originalFetch = globalThis.fetch
	})

	afterEach(() => {
		globalThis.fetch = originalFetch
	})

	it("posts FS responses to the configured target origin", async () => {
		const iframePostMessage = vi.fn()
		const iframeRef = makeIframeRef(iframePostMessage)

		const { result } = renderHook(() =>
			useIframeFS({
				iframeRef,
				targetOrigin,
				entryPath: "app/index.html",
				fileList: [{ file_id: "file-1", relative_file_path: "app/data.json" }],
				appConfig: null,
				uploadFn: vi.fn(),
				saveContentFn: vi.fn(),
			}),
		)

		await act(async () => {
			await result.current.handleFSMessage("MAGIC_FS_LIST_REQUEST", {
				requestId: "fs-1",
				dir: "./",
			})
		})

		expect(iframePostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "MAGIC_FS_LIST_RESPONSE",
				requestId: "fs-1",
				success: true,
			}),
			targetOrigin,
		)
	})

	it("posts LLM responses to the configured target origin", async () => {
		const iframePostMessage = vi.fn()
		const iframeRef = makeIframeRef(iframePostMessage)

		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () =>
					Promise.resolve({
						code: 1000,
						data: {
							api_key: "test-api-key",
							refresh_token: "refresh-token",
							expires_in: 3600,
						},
					}),
				text: () => Promise.resolve(""),
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ data: [{ id: "gpt-4" }] }),
				text: () => Promise.resolve(""),
			}) as unknown as typeof globalThis.fetch

		const { result } = renderHook(() =>
			useIframeLLM({
				iframeRef,
				targetOrigin,
				baseUrl: "https://api.example.com",
				getAuthorization: () => "Bearer test-token",
				getOrganizationCode: () => "org-1",
			}),
		)

		await act(async () => {
			await result.current.handleLLMMessage("MAGIC_LLM_GET_MODELS_REQUEST", {
				requestId: "llm-1",
			})
		})

		expect(iframePostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "MAGIC_LLM_GET_MODELS_RESPONSE",
				requestId: "llm-1",
				success: true,
			}),
			targetOrigin,
		)
	})

	it("posts Agent responses to the configured target origin", async () => {
		const iframePostMessage = vi.fn()
		const iframeRef = makeIframeRef(iframePostMessage)

		const { result } = renderHook(() =>
			useIframeAgent({
				iframeRef,
				targetOrigin,
				getAgentList: () => [
					{
						id: "agent-1",
						name: "Agent",
						icon: "sparkles",
						color: "#000",
						type: "custom",
					},
				],
				createTopicAndSend: vi.fn(),
				sendMessage: vi.fn(),
			}),
		)

		await act(async () => {
			await result.current.handleAgentMessage("MAGIC_GET_AGENTS_REQUEST", {
				requestId: "agent-1",
			})
		})

		expect(iframePostMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "MAGIC_GET_AGENTS_RESPONSE",
				requestId: "agent-1",
				success: true,
			}),
			targetOrigin,
		)
	})
})
