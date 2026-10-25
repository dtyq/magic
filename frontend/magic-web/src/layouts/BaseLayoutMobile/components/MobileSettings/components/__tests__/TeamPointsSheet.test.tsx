import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import type { MobileSettingsPointsOverview } from "../../types"
import { MobileSettingsTeamPointsSheet } from "../TeamPointsSheet"

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

/** Render a synthetic team-member overview without depending on the user store or network. */
function renderTeamPoints(primaryPoints: number | null, onClose = vi.fn()) {
	getOverviewMock.mockReturnValue({
		role: "teamMember",
		primaryPoints,
		personalQuota: null,
		hasLoadedData: primaryPoints != null,
	})

	return { onClose, ...render(<MobileSettingsTeamPointsSheet open onClose={onClose} />) }
}

describe("MobileSettingsTeamPointsSheet", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("按原型展示余额、说明和千分位数字", () => {
		renderTeamPoints(88888)

		expect(screen.getByText("setting.teamPointsSheet.title")).toBeInTheDocument()
		expect(screen.getByText("setting.teamPointsSheet.balanceLabel")).toBeInTheDocument()
		expect(screen.getByText("88,888")).toBeInTheDocument()
		expect(screen.getByText("setting.teamPointsSheet.hint")).toBeInTheDocument()
		expect(screen.getByTestId("mobile-settings-team-points-confirm")).toHaveTextContent(
			"setting.teamPointsSheet.cta",
		)
	})

	test("点击我知道了只关闭当前 Sheet", () => {
		const { onClose } = renderTeamPoints(793398)

		fireEvent.click(screen.getByTestId("mobile-settings-team-points-confirm"))

		expect(onClose).toHaveBeenCalledTimes(1)
	})

	test("无积分缓存时保留占位，不误报为零", () => {
		renderTeamPoints(null)

		expect(screen.getByText("--")).toBeInTheDocument()
		expect(screen.queryByText("0")).not.toBeInTheDocument()
	})
})
