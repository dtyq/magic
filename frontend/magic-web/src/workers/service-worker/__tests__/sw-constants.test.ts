import { describe, expect, it } from "vitest"
import { isCacheableApiRequest } from "../sw-constants"

describe("isCacheableApiRequest matching rules", () => {
	it("should match exact string cacheable APIs", () => {
		expect(isCacheableApiRequest("/api/v1/auth/environment")).toBe(true)
		expect(isCacheableApiRequest("/v4/locales/settings")).toBe(true)
	})

	it("should match regular expression cacheable APIs", () => {
		expect(isCacheableApiRequest("/api/v1/settings/all")).toBe(true)
		expect(isCacheableApiRequest("/api/v1/settings/menu-modules")).toBe(true)
	})

	it("should normalize and match URLs with trailing slashes, whitespaces, or missing leading slash", () => {
		expect(isCacheableApiRequest(" /api/v1/auth/environment ")).toBe(true)
		expect(isCacheableApiRequest("/api/v1/auth/environment/")).toBe(true)
		expect(isCacheableApiRequest("api/v1/auth/environment")).toBe(true)
		expect(isCacheableApiRequest("api/v1/settings/all/")).toBe(true)
	})

	it("should match cacheable APIs containing query parameters and hashes", () => {
		expect(isCacheableApiRequest("/api/v1/auth/environment?userId=123")).toBe(true)
		expect(isCacheableApiRequest("/api/v1/settings/all?foo=bar#section")).toBe(true)
	})

	it("should NOT match non-cacheable APIs even if their query parameters contain cacheable URLs", () => {
		// Non-cacheable endpoint containing cacheable URL as a parameter
		expect(isCacheableApiRequest("/api/v1/proxy?url=/api/v1/settings/all")).toBe(false)
		expect(isCacheableApiRequest("/api/v1/proxy?url=https://localhost/api/v1/auth/environment")).toBe(false)
		expect(isCacheableApiRequest("/api/v1/user/redirect?url=%2Fv4%2Flocales%2Fsettings")).toBe(false)
	})

	it("should NOT match non-cacheable APIs", () => {
		expect(isCacheableApiRequest("/api/v1/settings/other")).toBe(false)
		expect(isCacheableApiRequest("/api/v1/modes/default")).toBe(false)
		expect(isCacheableApiRequest("/api/v1/user/profile")).toBe(false)
		expect(isCacheableApiRequest("/api/v1/super-agent/workspaces/queries")).toBe(false)
		expect(isCacheableApiRequest("/api/v1/admin/subscription")).toBe(false)
		expect(isCacheableApiRequest("/api/v1/super-agent/user/special-projects")).toBe(false)
		expect(isCacheableApiRequest("")).toBe(false)
	})
})
