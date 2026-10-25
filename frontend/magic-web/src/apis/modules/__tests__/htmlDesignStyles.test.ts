import { describe, expect, it, vi } from "vitest"
import { generateHtmlDesignStylesApi } from "../htmlDesignStyles"

vi.mock("@/utils/http", () => ({
	genRequestUrl: (template: string, params?: Record<string, string>) =>
		template.replace(/\$\{(\w+)\}/g, (_, key: string) => params?.[key] ?? ""),
}))

describe("htmlDesignStyles API", () => {
	it("requests the style source endpoint with an encoded style code", async () => {
		const get = vi.fn().mockResolvedValue({
			style_code: "apple",
			content: "# Apple",
			sha256: "abc",
		})
		const api = generateHtmlDesignStylesApi({ get } as never)

		const result = await api.getSource({ styleCode: "apple" })

		expect(get).toHaveBeenCalledWith("/api/v1/super-magic/html-design-styles/apple/source")
		expect(result.content).toBe("# Apple")
	})

	it("encodes unsafe characters in the style code", async () => {
		const get = vi.fn().mockResolvedValue({ style_code: "x", content: "", sha256: "" })
		const api = generateHtmlDesignStylesApi({ get } as never)

		await api.getSource({ styleCode: "a/b" })

		expect(get).toHaveBeenCalledWith("/api/v1/super-magic/html-design-styles/a%2Fb/source")
	})
})
