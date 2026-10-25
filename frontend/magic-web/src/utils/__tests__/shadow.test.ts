import { describe, expect, it } from "vitest"
import vectors from "../../../../../backend/super-magic/tests/fixtures/shadow_code_vectors.json"
import { isShadowed, shadow, shadowV2, unshadow } from "../shadow"

describe("ShadowCode V2 跨端协议", () => {
	it.each(vectors.valid)("无损还原共享样例 $name", ({ plain, v1, v2 }) => {
		expect(shadowV2(plain)).toBe(v2)
		expect(shadow(plain)).toBe(v2)
		expect(unshadow(v2)).toBe(plain)
		expect(isShadowed(v2)).toBe(true)
		if (v1 !== null) expect(unshadow(v1)).toBe(plain)
	})

	it.each(vectors.invalid)("拒绝错误或未知载荷 %s", (payload) => {
		expect(isShadowed(payload)).toBe(true)
		expect(() => unshadow(payload)).toThrow()
	})

	it("无前缀明文原样返回，孤立代理项不得静默替换", () => {
		expect(unshadow("저는 raw text")).toBe("저는 raw text")
		expect(() => shadowV2("\ud800")).toThrow("Invalid shadow payload")
		expect(() => shadowV2("\udc00")).toThrow("Invalid shadow payload")
	})

	it("分批覆盖所有 Unicode 标量值", () => {
		for (let start = 0; start < 0x110000; start += 4096) {
			let text = ""
			for (let code = start; code < Math.min(start + 4096, 0x110000); code += 1) {
				if (code < 0xd800 || code > 0xdfff) text += String.fromCodePoint(code)
			}
			expect(unshadow(shadowV2(text))).toBe(text)
		}
	})

	it("大输入使用分块编码，不超过参数栈上限", () => {
		const text = "저\u1000\ufeff".repeat(128 * 1024)
		expect(unshadow(shadowV2(text))).toBe(text)
	})
})
