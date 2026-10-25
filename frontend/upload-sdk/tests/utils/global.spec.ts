import { beforeEach, describe, expect, it, vi } from "vitest"
import { getUploadConfig } from "../../src/utils/global"
import type { Request } from "../../src/types"

const requestCount = vi.fn()

function createRequest(
	url: string,
	authorization?: string,
	authorizationHeader = "Authorization",
): Request {
	return {
		url,
		method: "POST",
		headers: authorization ? { [authorizationHeader]: authorization } : undefined,
		body: JSON.stringify({ storage: "private" }),
	}
}

function createCredentialResponse(expirationField: "expire" | "expires") {
	return JSON.stringify({
		code: 1000,
		message: "ok",
		data: {
			platform: "tos",
			temporary_credential: {
				bucket: "test-bucket",
				dir: "test-dir/",
			},
			[expirationField]: Math.floor(Date.now() / 1000) + 60 * 60,
		},
	})
}

function setupCredentialRequest(response: string) {
	vi.stubGlobal(
		"XMLHttpRequest",
		vi.fn(() => {
			const xhr = {
				readyState: 0,
				status: 200,
				responseType: "json",
				response,
				responseText: response,
				upload: {},
				open: vi.fn(),
				setRequestHeader: vi.fn(),
				getAllResponseHeaders: vi.fn().mockReturnValue(""),
				send: vi.fn(() => {
					requestCount()
					setTimeout(() => {
						xhr.readyState = 4
						xhr.onreadystatechange?.()
					}, 0)
				}),
				onreadystatechange: undefined as (() => void) | undefined,
			}
			return xhr
		}),
	)
}

async function waitForQueueToIdle() {
	await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

describe("getUploadConfig", () => {
	beforeEach(() => {
		requestCount.mockReset()
	})

	it("应兼容 expires 字段并命中同一 Authorization 的缓存", async () => {
		setupCredentialRequest(createCredentialResponse("expires"))
		const uploadRequest = createRequest("https://example.com/credential", "Bearer user-a")

		const first = await getUploadConfig(uploadRequest)
		const second = await getUploadConfig(uploadRequest)

		expect(first).toEqual(second)
		expect(first.expire).toBeGreaterThan(Math.floor(Date.now() / 1000))
		expect(first).not.toHaveProperty("expires")
		expect(requestCount).toHaveBeenCalledTimes(1)
	})

	it("应兼容 expire 字段并命中同一 Authorization 的缓存", async () => {
		setupCredentialRequest(createCredentialResponse("expire"))
		const uploadRequest = createRequest(
			"https://example.com/legacy-credential",
			"Bearer user-a",
			"authorization",
		)

		await getUploadConfig(uploadRequest)
		await getUploadConfig(uploadRequest)

		expect(requestCount).toHaveBeenCalledTimes(1)
	})

	it("同一 URL 使用不同 Authorization 时不得共享缓存", async () => {
		setupCredentialRequest(createCredentialResponse("expires"))
		const url = "https://example.com/scoped-credential"

		await getUploadConfig(createRequest(url, "Bearer user-a"))
		await waitForQueueToIdle()
		await getUploadConfig(createRequest(url, "Bearer user-b"))

		expect(requestCount).toHaveBeenCalledTimes(2)
	})

	it("未传 Authorization 时保持 URL 缓存兼容", async () => {
		setupCredentialRequest(createCredentialResponse("expires"))
		const uploadRequest = createRequest("https://example.com/anonymous-credential")

		await getUploadConfig(uploadRequest)
		await getUploadConfig(uploadRequest)

		expect(requestCount).toHaveBeenCalledTimes(1)
	})
})
