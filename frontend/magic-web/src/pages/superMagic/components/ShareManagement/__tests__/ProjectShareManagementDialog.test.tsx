import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ProjectShareManagementDialog from "../ProjectShareManagementDialog"
import { SharedResourceType, SharedTopicFilterStatus } from "../types"

const corePropsMock = vi.hoisted(() => ({
	props: [] as Array<{
		projectId: string
		resourceType: SharedResourceType
		filterStatus: SharedTopicFilterStatus
		currentPage: number
	}>,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: ({
		title,
		open,
		children,
	}: {
		title: React.ReactNode
		open: boolean
		children: React.ReactNode
	}) =>
		open ? (
			<div>
				<div>{title}</div>
				{children}
			</div>
		) : null,
}))

vi.mock("@/components/shadcn-ui/smooth-tabs", () => ({
	SmoothTabs: ({
		tabs,
		onChange,
	}: {
		tabs: Array<{ value: string; label: string }>
		onChange: (value: string) => void
	}) => (
		<div>
			{tabs.map((tab) => (
				<button key={tab.value} type="button" onClick={() => onChange(tab.value)}>
					{tab.label}
				</button>
			))}
		</div>
	),
}))

vi.mock("@/components/shadcn-ui/select", () => ({
	Select: ({
		value,
		onValueChange,
		children,
	}: {
		value: string
		onValueChange: (value: string) => void
		children: React.ReactNode
	}) => (
		<select
			data-testid="status-select"
			value={value}
			onChange={(event) => onValueChange(event.target.value)}
		>
			{children}
		</select>
	),
	SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	SelectValue: () => null,
	SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
		<option value={value}>{children}</option>
	),
}))

vi.mock("../components/FileShareManagementListCore", () => ({
	default: (props: (typeof corePropsMock.props)[number]) => {
		corePropsMock.props.push(props)
		return <div data-testid="list-core" />
	},
}))

vi.mock("../components/ShareListFooter", () => ({
	default: ({
		currentPage,
		onPageChange,
	}: {
		currentPage: number
		onPageChange: (page: number) => void
	}) => (
		<button type="button" data-testid="next-page" onClick={() => onPageChange(currentPage + 1)}>
			next
		</button>
	),
}))

const lastProps = () => corePropsMock.props[corePropsMock.props.length - 1]

describe("ProjectShareManagementDialog", () => {
	beforeEach(() => {
		corePropsMock.props = []
	})

	it("starts with this project's own active shares", () => {
		render(<ProjectShareManagementDialog open projectId="p-1" onClose={vi.fn()} />)

		expect(screen.getByText("project.manageShare")).toBeInTheDocument()
		expect(lastProps()).toMatchObject({
			projectId: "p-1",
			resourceType: SharedResourceType.Project,
			filterStatus: SharedTopicFilterStatus.Active,
			currentPage: 1,
		})
	})

	it("switches to file shares and resets paging on tab or status change", () => {
		render(<ProjectShareManagementDialog open projectId="p-1" onClose={vi.fn()} />)

		fireEvent.click(screen.getByTestId("next-page"))
		expect(lastProps().currentPage).toBe(2)

		fireEvent.click(screen.getByText("shareManagement.fileShare"))
		expect(lastProps()).toMatchObject({ resourceType: SharedResourceType.File, currentPage: 1 })

		fireEvent.click(screen.getByTestId("next-page"))
		fireEvent.change(screen.getByTestId("status-select"), {
			target: { value: SharedTopicFilterStatus.Expired },
		})
		expect(lastProps()).toMatchObject({
			filterStatus: SharedTopicFilterStatus.Expired,
			currentPage: 1,
		})
	})
})
