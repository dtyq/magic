import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SelectItem from "./SelectItem"

const mocks = vi.hoisted(() => ({
	addWorkspace: vi.fn(),
	addProject: vi.fn(),
	addTopic: vi.fn(),
	toastError: vi.fn(),
	projectOptions: [] as Array<{ label: string; value: string }>,
	topicOptions: [] as Array<{ label: string; value: string }>,
}))

vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => true }))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("antd", async () => {
	const React = await import("react")
	type TestInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
		onPressEnter?: (event: React.KeyboardEvent<HTMLInputElement>) => void
	}

	return {
		Avatar: () => <div data-testid="avatar" />,
		Empty: () => <div data-testid="empty" />,
		Input: React.forwardRef<HTMLInputElement, TestInputProps>(
			({ onKeyDown, onPressEnter, ...props }, ref) => (
				<input
					ref={ref}
					{...props}
					onKeyDown={(event) => {
						onKeyDown?.(event)
						if (event.key === "Enter") onPressEnter?.(event)
					}}
				/>
			),
		),
	}
})

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
		visible ? <div data-testid="magic-popup">{children}</div> : null,
}))

vi.mock("@/components/base/MagicIcon", () => ({ default: () => null }))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { error: mocks.toastError },
}))

vi.mock("../hooks/useWorkspace", () => ({
	useWorkspace: () => ({ workspaceOptions: [], handleAddWorkspace: mocks.addWorkspace }),
}))

vi.mock("../hooks/useProjects", () => ({
	useProjects: () => ({
		projectOptions: mocks.projectOptions,
		handleAddProject: mocks.addProject,
	}),
}))

vi.mock("../hooks/useTopics", () => ({
	useTopics: () => ({ topicOptions: mocks.topicOptions, handleAddTopic: mocks.addTopic }),
}))

describe("SelectItem create flow", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.projectOptions.length = 0
		mocks.topicOptions.length = 0
		mocks.addProject.mockResolvedValue({ id: "project-1", project_name: "Brand new" })
	})

	it("selects the first topic when a new mobile task has no topic context", async () => {
		mocks.topicOptions.push(
			{ label: "First mock topic", value: "mock-topic-first" },
			{ label: "Second mock topic", value: "mock-topic-second" },
		)
		const onChange = vi.fn()
		const onSelect = vi.fn()

		render(
			<SelectItem
				type="topic"
				workspaceId="mock-workspace"
				projectId="mock-project"
				autoSelectFirstOption
				onChange={onChange}
				onSelect={onSelect}
			/>,
		)

		await waitFor(() => {
			expect(onChange).toHaveBeenCalledWith("mock-topic-first")
			expect(onSelect).toHaveBeenCalledWith({
				label: "First mock topic",
				value: "mock-topic-first",
			})
		})
	})

	it("closes the mobile popup after selecting an existing project", () => {
		mocks.projectOptions.push({ label: "Existing project", value: "project-existing" })
		const onChange = vi.fn()
		render(<SelectItem type="project" workspaceId="workspace-1" onChange={onChange} />)

		fireEvent.click(screen.getByRole("button", { name: "accountPanel.timedTasks.project" }))
		fireEvent.click(screen.getByRole("button", { name: "Existing project" }))

		expect(onChange).toHaveBeenCalledWith("project-existing")
		expect(screen.queryByTestId("magic-popup")).not.toBeInTheDocument()
	})

	it("separates the search value from the new project name and closes after creation", async () => {
		const onChange = vi.fn()
		const onSelect = vi.fn()
		render(
			<SelectItem
				type="project"
				workspaceId="workspace-1"
				onChange={onChange}
				onSelect={onSelect}
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "accountPanel.timedTasks.project" }))
		fireEvent.change(screen.getByPlaceholderText("accountPanel.timedTasks.searchProject"), {
			target: { value: "filter only" },
		})
		fireEvent.click(screen.getByRole("button", { name: "accountPanel.timedTasks.addProject" }))

		const createInput = screen.getByPlaceholderText(
			"accountPanel.timedTasks.createProjectPlaceholder",
		)
		expect(createInput).toHaveValue("")
		fireEvent.change(createInput, { target: { value: "Brand new" } })
		fireEvent.click(screen.getByRole("button", { name: "accountPanel.timedTasks.create" }))

		await waitFor(() => expect(mocks.addProject).toHaveBeenCalledWith("Brand new"))
		expect(onChange).toHaveBeenCalledWith("project-1")
		expect(onSelect).toHaveBeenCalledWith({ value: "project-1", label: "Brand new" })
		expect(screen.queryByTestId("magic-popup")).not.toBeInTheDocument()
	})

	it("prevents duplicate creation while the first request is pending", async () => {
		let resolveCreation: ((value: { id: string; project_name: string }) => void) | undefined
		mocks.addProject.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveCreation = resolve
				}),
		)
		render(<SelectItem type="project" workspaceId="workspace-1" />)

		fireEvent.click(screen.getByRole("button", { name: "accountPanel.timedTasks.project" }))
		fireEvent.click(screen.getByRole("button", { name: "accountPanel.timedTasks.addProject" }))
		const createInput = screen.getByPlaceholderText(
			"accountPanel.timedTasks.createProjectPlaceholder",
		)
		fireEvent.change(createInput, { target: { value: "Brand new" } })

		fireEvent.keyDown(createInput, { key: "Enter" })
		fireEvent.keyDown(createInput, { key: "Enter" })

		expect(mocks.addProject).toHaveBeenCalledTimes(1)
		resolveCreation?.({ id: "project-1", project_name: "Brand new" })
		await waitFor(() => expect(screen.queryByTestId("magic-popup")).not.toBeInTheDocument())
	})

	it("keeps the filtered list visible and preserves its search when creation is cancelled", () => {
		render(<SelectItem type="project" workspaceId="workspace-1" />)

		fireEvent.click(screen.getByRole("button", { name: "accountPanel.timedTasks.project" }))
		const searchInput = screen.getByPlaceholderText("accountPanel.timedTasks.searchProject")
		fireEvent.change(searchInput, { target: { value: "existing filter" } })
		fireEvent.click(screen.getByRole("button", { name: "accountPanel.timedTasks.addProject" }))
		expect(screen.getByPlaceholderText("accountPanel.timedTasks.searchProject")).toHaveValue(
			"existing filter",
		)
		fireEvent.change(
			screen.getByPlaceholderText("accountPanel.timedTasks.createProjectPlaceholder"),
			{ target: { value: "Draft project" } },
		)
		fireEvent.click(screen.getByRole("button", { name: "accountPanel.timedTasks.cancel" }))

		expect(screen.getByPlaceholderText("accountPanel.timedTasks.searchProject")).toHaveValue(
			"existing filter",
		)
		expect(mocks.addProject).not.toHaveBeenCalled()
	})

	it("explains why project creation is unavailable before selecting a workspace", () => {
		render(<SelectItem type="project" />)

		fireEvent.click(screen.getByRole("button", { name: "accountPanel.timedTasks.project" }))

		expect(
			screen.getByRole("button", { name: "accountPanel.timedTasks.addProject" }),
		).toBeDisabled()
		expect(screen.getByText("super:project.pleaseSelectWorkspace")).toBeInTheDocument()
	})
})
