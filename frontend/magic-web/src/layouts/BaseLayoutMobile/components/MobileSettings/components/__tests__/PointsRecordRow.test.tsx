import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"

import { MobileSettingsPointsRecordRow } from "../PointsRecordRow"
import type { PointsRecordItem } from "../../types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			if (key === "topic.unnamedTopic") return "未命名话题"
			return key
		},
	}),
}))

const noop = () => undefined

const baseItem: PointsRecordItem = {
	id: "pt-1",
	amount: -40,
	label: "话题 ID: 912313626383110145",
	description: "下载猫咪图片",
	createdAt: "2026-05-20 10:00:00",
	updatedAt: "05-20 19:45",
}

describe("MobileSettingsPointsRecordRow", () => {
	test("renders description as primary title and raw updated_at", () => {
		render(<MobileSettingsPointsRecordRow item={baseItem} showDivider={false} onClick={noop} />)

		expect(screen.getByText("下载猫咪图片")).toBeInTheDocument()
		expect(screen.queryByText("话题 ID: 912313626383110145")).not.toBeInTheDocument()
		expect(screen.getByText("05-20 19:45")).toBeInTheDocument()
	})

	test("renders signed amount without income highlight color", () => {
		const { container } = render(
			<MobileSettingsPointsRecordRow item={baseItem} showDivider={false} onClick={noop} />,
		)

		expect(screen.getByText("- 40")).toBeInTheDocument()
		expect(container.querySelector(".text-emerald-600")).toBeNull()
		expect(container.querySelector(".text-emerald-400")).toBeNull()
	})

	test("calls onClick when row is pressed", () => {
		const handleClick = vi.fn()

		render(
			<MobileSettingsPointsRecordRow
				item={baseItem}
				showDivider={false}
				onClick={handleClick}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-settings-points-record-row-pt-1"))
		expect(handleClick).toHaveBeenCalledTimes(1)
	})
})
