import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import Avatar from "@/components/Avatar"

describe("Avatar", () => {
	it("badge 数值超过 99 时展示 99+", () => {
		render(
			<Avatar src="https://example.com/avatar.png" badgeProps={{ count: 128 }}>
				A
			</Avatar>,
		)

		expect(screen.getByText("99+")).toBeInTheDocument()
	})

	it("circle 形状会应用圆形样式类名", () => {
		const { container } = render(<Avatar shape="circle">AB</Avatar>)

		const avatarRoot = container.querySelector(".rounded-full")
		expect(avatarRoot).toBeInTheDocument()
	})
})
