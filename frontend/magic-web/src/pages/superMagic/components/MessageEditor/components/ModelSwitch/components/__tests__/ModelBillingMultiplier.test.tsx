import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ModelBillingMultiplier } from "../ModelBillingMultiplier"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
afterEach(cleanup)

it("缺失或非法倍率不显示，明确的零倍率正常显示", () => {
	for (const value of [undefined, null, -1, NaN, Infinity]) {
		const { container } = render(<ModelBillingMultiplier value={value} />)
		expect(container.textContent).toBe("")
		cleanup()
	}
	render(<ModelBillingMultiplier value={0} />)
	expect(screen.getByText("0.00×")).toBeTruthy()
})

it.each([
	[1, "1.00×"],
	[0.28, "0.28×"],
	[0.001, "<0.01×"],
	[0.01, "0.01×"],
	[1.235, "1.24×"],
])("格式化倍率 %s", (value, expected) => {
	render(<ModelBillingMultiplier value={Number(value)} />)
	expect(screen.getByText(String(expected))).toBeTruthy()
})
