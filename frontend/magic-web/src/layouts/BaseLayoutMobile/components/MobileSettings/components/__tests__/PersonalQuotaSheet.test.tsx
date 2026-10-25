import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import type { MobileSettingsPointsOverview } from "../../types"
import { MobileSettingsPersonalQuotaSheet } from "../PersonalQuotaSheet"

const getOverviewMock = vi.hoisted(() => vi.fn<() => MobileSettingsPointsOverview>())

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("../SheetContainer", () => ({
	MobileSettingsSheetContainer: (props: { children: React.ReactNode; title: string }) => (
		<div>
			<h1>{props.title}</h1>
			{props.children}
		</div>
	),
}))

vi.mock("../../utils", () => ({
	getMobileSettingsPointsOverview: getOverviewMock,
}))

/** Render a synthetic overview so the sheet test never depends on live organization data. */
function renderQuota(quota: MobileSettingsPointsOverview["personalQuota"]) {
	getOverviewMock.mockReturnValue({
		role: "teamMember",
		primaryPoints: 88,
		personalQuota: quota,
		hasLoadedData: true,
	})

	return render(<MobileSettingsPersonalQuotaSheet open onClose={vi.fn()} />)
}

describe("MobileSettingsPersonalQuotaSheet", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("按原型显示圆环、百分比和使用量", () => {
		renderQuota({ used: 75, total: 300, percent: 25 })

		expect(screen.getByText("25%")).toBeInTheDocument()
		expect(screen.getByText("setting.personalQuotaSheet.usageFraction")).toBeInTheDocument()
		expect(
			screen.getByRole("button", { name: "setting.personalQuotaSheet.cta" }),
		).toBeInTheDocument()
		expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
	})

	test("保留 0/0 并显示零百分比说明", () => {
		renderQuota({ used: 0, total: 0, percent: 0 })

		expect(screen.getByText("0%")).toBeInTheDocument()
		expect(screen.getByText("setting.personalQuotaZeroDescription")).toBeInTheDocument()
	})

	test("额度字段缺失时不把空值误报为零", () => {
		renderQuota(null)

		expect(screen.getAllByText("--")).toHaveLength(2)
	})

	test("点击确认按钮只关闭当前面板", () => {
		const onClose = vi.fn()
		getOverviewMock.mockReturnValue({
			role: "teamMember",
			primaryPoints: 88,
			personalQuota: { used: 75, total: 300, percent: 25 },
			hasLoadedData: true,
		})

		render(<MobileSettingsPersonalQuotaSheet open onClose={onClose} />)
		fireEvent.click(screen.getByRole("button", { name: "setting.personalQuotaSheet.cta" }))

		expect(onClose).toHaveBeenCalledTimes(1)
	})
})
