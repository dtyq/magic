import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import MagicAvatar from ".."
import type { ReactNode } from "react"

// The global Ant Design test mock serializes src; Avatar's real API renders ReactNode src.
vi.mock("antd", () => ({
	Avatar: ({ src }: { src: ReactNode }) => <span>{src}</span>,
	Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock("antd-style", () => ({
	createStyles: () => () => ({
		styles: { avatar: "avatar" },
		cx: (...values: unknown[]) => values.filter(Boolean).join(" "),
	}),
}))

vi.mock("@/services/chat/avatar", () => ({
	default: { drawTextAvatar: () => "data:image/png;base64,fallback" },
}))

describe("MagicAvatar image variants", () => {
	it("renders the thumbnail first, then falls back to the original and text avatar", () => {
		const original = "https://static-legacy.dingtalk.com/avatar.jpg"
		render(
			<MagicAvatar src={original} size={32}>
				User
			</MagicAvatar>,
		)
		const img = screen.getByAltText("User")
		expect(img).toHaveAttribute("src", "https://static-legacy.dingtalk.com/avatar.jpg@64w_64h")
		fireEvent.error(img)
		expect(img).toHaveAttribute("src", original)
		fireEvent.error(img)
		expect(img).toHaveAttribute("src", "data:image/png;base64,fallback")
	})
})
