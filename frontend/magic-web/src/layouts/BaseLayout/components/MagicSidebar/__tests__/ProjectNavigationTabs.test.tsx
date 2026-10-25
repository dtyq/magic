import { fireEvent, render, screen } from "@testing-library/react"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ProjectNavigationTabs from "../ProjectNavigationTabs"

const { selectNavigationSection, containerSize } = vi.hoisted(() => ({
	selectNavigationSection: vi.fn(),
	containerSize: { width: 300, height: 32 },
}))

vi.mock("ahooks", () => ({ useSize: () => containerSize }))

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/stores/layout/SidebarStore", () => ({
	sidebarStore: {
		expandedNavigationSection: "workspaces",
		selectNavigationSection,
	},
}))

vi.mock("@/components/base/MagicTooltip", () => ({
	default: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button {...props}>{children}</button>
	),
}))

vi.mock("@/components/shadcn-ui/smooth-tabs", () => ({
	SmoothTabs: ({
		tabs,
		value,
		onChange,
		className,
		buttonClassName,
		indicatorClassName,
		"data-testid": dataTestId,
	}: {
		tabs: Array<{
			value: string
			label: string
			icon?: ReactNode
			testId?: string
		}>
		value: string
		onChange: (value: string) => void
		className?: string
		buttonClassName?: string
		indicatorClassName?: string
		"data-testid"?: string
	}) => (
		<div
			data-testid={dataTestId}
			data-value={value}
			data-class-name={className}
			data-button-class-name={buttonClassName}
			data-indicator-class-name={indicatorClassName}
		>
			{tabs.map((tab) => (
				<button
					key={tab.value}
					data-testid={tab.testId}
					onClick={() => onChange(tab.value)}
				>
					{tab.icon}
					{tab.label}
				</button>
			))}
		</div>
	),
}))

describe("ProjectNavigationTabs", () => {
	beforeEach(() => {
		selectNavigationSection.mockClear()
		containerSize.width = 300
	})

	it("复用文件侧栏 SmoothTabs 样式并保留栏目切换事件", () => {
		const onOpenManager = vi.fn()
		render(<ProjectNavigationTabs disabled={false} onOpenManager={onOpenManager} />)

		const tabs = screen.getByTestId("sidebar-navigation-tabs")
		const group = screen.getByRole("group")
		const header = group.parentElement
		expect(header).toHaveClass("z-30", "gap-2")
		expect(header).toHaveClass("bg-sidebar")
		expect(group.firstElementChild).toHaveClass("min-w-0", "w-full")
		expect(tabs).toHaveAttribute("data-value", "workspaces")
		expect(tabs).toHaveAttribute("data-class-name", "h-auto w-full bg-muted p-[3px]")
		expect(tabs).toHaveAttribute(
			"data-button-class-name",
			"h-[28px] min-w-0 px-1 py-0 text-[13px] font-normal focus-visible:bg-sidebar-accent focus-visible:ring-1",
		)
		expect(tabs).toHaveAttribute("data-indicator-class-name", "inset-y-[3px] h-[28px]")

		fireEvent.click(screen.getByTestId("sidebar-recent-projects-toggle"))
		expect(selectNavigationSection).toHaveBeenCalledWith("recent")

		fireEvent.click(screen.getByTestId("sidebar-workspaces-toggle"))
		expect(selectNavigationSection).toHaveBeenCalledWith("workspaces")

		expect(screen.queryByTestId("sidebar-chats-toggle")).not.toBeInTheDocument()

		const managerButton = screen.getByTestId("sidebar-project-manager")
		expect(managerButton).toHaveClass("!size-[34px]", "!rounded-[10px]", "!bg-muted")
		fireEvent.click(managerButton)
		expect(onOpenManager).toHaveBeenCalledTimes(1)
	})

	it("hides decorative icons at narrow widths and restores them after resizing", () => {
		const { rerender } = render(
			<ProjectNavigationTabs disabled={false} onOpenManager={vi.fn()} />,
		)
		const recent = screen.getByTestId("sidebar-recent-projects-toggle")
		expect(recent.querySelector("svg")).toBeInTheDocument()
		containerSize.width = 240
		rerender(<ProjectNavigationTabs disabled={false} onOpenManager={vi.fn()} />)
		expect(recent.querySelector("svg")).not.toBeInTheDocument()
		expect(recent).toHaveTextContent("projectNavigation.recentShort")
		containerSize.width = 241
		rerender(<ProjectNavigationTabs disabled={false} onOpenManager={vi.fn()} />)
		expect(recent.querySelector("svg")).toBeInTheDocument()
	})
})
