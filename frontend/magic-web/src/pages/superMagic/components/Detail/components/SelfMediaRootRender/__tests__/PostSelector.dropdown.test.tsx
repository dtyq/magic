import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: { index?: number }) =>
			key === "detail.selfMedia.common.postFallbackTitle" && params?.index
				? `Post ${params.index}`
				: key,
	}),
}))

vi.mock("@/components/shadcn-ui/select", () => ({
	Select: ({
		children,
		value,
		onValueChange,
	}: {
		children: React.ReactNode
		value: string
		onValueChange: (value: string) => void
	}) => (
		<div data-testid="mock-select-root" data-value={value} onClick={() => onValueChange(value)}>
			{children}
		</div>
	),
	SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
		<div data-testid="mock-select-trigger" className={className}>
			{children}
		</div>
	),
	SelectValue: () => <span data-testid="mock-select-value" />,
	SelectContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
		<div data-testid="mock-select-content" className={className}>
			{children}
		</div>
	),
	SelectItem: ({
		children,
		value,
		"data-testid": dataTestId,
	}: {
		children: React.ReactNode
		value: string
		"data-testid"?: string
	}) => (
		<div data-testid={dataTestId} data-value={value}>
			{children}
		</div>
	),
}))

import PostSelector from "../components/PostSelector"

describe("PostSelector dropdown", () => {
	it("does not constrain dropdown width to trigger width", () => {
		render(
			<PostSelector
				posts={[
					{
						meta: {
							id: "post-1",
							title: "Pocket 3 vs Pocket 4，差¥200值不值？看完这篇再决定",
						},
						cards: [],
					},
					{
						meta: {
							id: "post-2",
							title: "青甘大环线6天5夜 | 彩虹山+天空之镜+青海湖人均2600",
						},
						cards: [],
					},
				]}
				activeIndex={0}
				onChange={vi.fn()}
				className="flex-1"
			/>,
		)

		const content = screen.getByTestId("mock-select-content")
		const option = screen.getByTestId("self-media-post-1")

		expect(content.className).not.toContain("max-w-[var(--radix-select-trigger-width)]")
		expect(option.textContent).toContain("青甘大环线6天5夜")
	})
})
