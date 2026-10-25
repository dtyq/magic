import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { RouteName } from "@/routes/constants"
import NewChatSidebarMenuItem from "../NewChatSidebarMenuItem"

const { navigate, createProject } = vi.hoisted(() => ({
	navigate: vi.fn(),
	createProject: vi.fn(),
}))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("@/routes/hooks/useNavigate", () => ({ default: () => navigate }))
vi.mock("@/pages/superMagic/services", () => ({ default: { project: { createProject } } }))
vi.mock("@/components/shadcn-ui/sidebar", () => ({
	SidebarMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SidebarMenuButton: ({
		children,
		isActive,
		...props
	}: { children: ReactNode; isActive?: boolean } & Record<string, unknown>) => (
		<button data-active={isActive} {...props}>
			{children}
		</button>
	),
}))

describe("NewChatSidebarMenuItem", () => {
	it("opens the blank composer without creating a conversation", () => {
		const onSelect = vi.fn()
		render(<NewChatSidebarMenuItem collapsed={false} onSelect={onSelect} />)
		fireEvent.click(screen.getByTestId("sidebar-content-new-chat-button"))
		expect(navigate).toHaveBeenCalledWith({
			name: RouteName.SuperChatHome,
			viewTransition: false,
		})
		expect(createProject).not.toHaveBeenCalled()
		expect(onSelect).toHaveBeenCalledTimes(1)
	})

	it("forwards the selected state to the sidebar button", () => {
		render(<NewChatSidebarMenuItem collapsed={false} isActive />)

		expect(screen.getByTestId("sidebar-content-new-chat-button")).toHaveAttribute(
			"data-active",
			"true",
		)
	})
})
