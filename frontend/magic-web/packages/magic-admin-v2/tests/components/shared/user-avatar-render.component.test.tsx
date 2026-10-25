import { fireEvent, render, screen } from "@testing-library/react"
import { UserAvatarRender } from "@magic-admin-v2/components/user-avatar-render"

describe("UserAvatarRender", () => {
	it("renders the shared square avatar style and default image", () => {
		const { container } = render(<UserAvatarRender name="Alice" />)
		const avatar = container.firstElementChild
		const image = screen.getByRole("img", { name: "Alice" })

		expect(avatar).toHaveClass("rounded-lg")
		expect(image).toHaveAttribute("src")
	})

	it("uses the shared fallback text after an image error", () => {
		render(<UserAvatarRender name="Alice" src="https://example.com/alice.png" />)
		fireEvent.error(screen.getByRole("img", { name: "Alice" }))

		expect(screen.getByText("E")).toBeInTheDocument()
	})

	it("supports explicit shape and size overrides", () => {
		const { container } = render(<UserAvatarRender name="张三" shape="circle" size={24} />)
		const avatar = container.firstElementChild

		expect(avatar).toHaveClass("rounded-full")
		expect(avatar).toHaveStyle({ height: "24px", width: "24px" })
	})
})
