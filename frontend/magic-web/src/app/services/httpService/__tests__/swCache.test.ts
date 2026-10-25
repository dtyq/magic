import { afterEach, describe, expect, it, vi } from "vitest"
import type { RequestConfig } from "@/infrastructure/network/http/clients/types"
import { createAppSwCacheInterceptor } from "../interceptors/request/swCache"

const state = vi.hoisted(() => ({ enabled: undefined as string | undefined }))
vi.mock("@/utils/env", () => ({ env: () => state.enabled }))
afterEach(() => {
	state.enabled = undefined
})

describe("existing application API cache policy", () => {
	it.each([
		{
			enabled: undefined,
			option: undefined,
			method: "GET",
			url: "/v4/locales/settings",
			cached: true,
		},
		{
			enabled: "true",
			option: "default",
			method: "get",
			url: "/v4/locales/settings?lang=en_US",
			cached: true,
		},
		{
			enabled: "false",
			option: "default",
			method: "GET",
			url: "/v4/locales/settings",
			cached: false,
		},
		{ enabled: "false", option: "cache", method: "GET", url: "/unlisted", cached: true },
		{
			enabled: "true",
			option: "no-cache",
			method: "GET",
			url: "/v4/locales/settings",
			cached: false,
		},
		{ enabled: "true", option: "default", method: "GET", url: "/unlisted", cached: false },
		{
			enabled: "true",
			option: "default",
			method: "GET",
			url: "/proxy?url=/v4/locales/settings",
			cached: false,
		},
		{
			enabled: "true",
			option: "cache",
			method: "POST",
			url: "/v4/locales/settings",
			cached: false,
		},
	] as const)(
		"preserves $method $url with switch=$enabled and option=$option",
		({ enabled, option, method, url, cached }) => {
			state.enabled = enabled
			const config: RequestConfig<Headers> = {
				url,
				method,
				swCacheOption: option,
				headers: new Headers(),
			}
			const result = createAppSwCacheInterceptor()(config)
			expect(new URL(result.url!, window.location.origin).searchParams.get("swCache")).toBe(
				cached ? "api-runtime" : null,
			)
		},
	)

	it("preserves absolute URL, existing query and hash when tagging", () => {
		const result = createAppSwCacheInterceptor()({
			url: "https://cluster.test/v4/locales/settings?language=zh_CN#part",
			headers: new Headers(),
		})
		expect(result.url).toBe(
			"https://cluster.test/v4/locales/settings?language=zh_CN&swCache=api-runtime#part",
		)
	})
})
