import type { ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import MicroAppDatabasePanelMobile from "../index"

const mocks = vi.hoisted(() => ({
	refreshTables: vi.fn(),
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({ t: (key: string) => key }),
	}
})

vi.mock("@/apis", () => ({
	MagicBaseApi: {
		getTables: vi.fn(),
		getTable: vi.fn(),
		queryRows: vi.fn(),
		getPermissions: vi.fn(),
	},
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({
		children,
		visible,
		position,
	}: {
		children: ReactNode
		visible?: boolean
		position?: string
	}) =>
		visible ? (
			<div data-testid="mobile-database-popup" data-position={position}>
				{children}
			</div>
		) : null,
}))

vi.mock("swr", () => ({
	default: (key: unknown) => {
		if (!Array.isArray(key)) return { data: undefined, isLoading: false, mutate: vi.fn() }
		if (key[1] === "tables") {
			return {
				data: [
					{
						id: "table-1",
						project_id: "project-1",
						table_key: "tasks",
						table_name: "任务表",
						description: "任务中文名",
						status: "enabled",
						columns: [],
					},
				],
				isLoading: false,
				mutate: mocks.refreshTables,
			}
		}
		if (key[1] === "table") {
			return {
				data: {
					id: "table-1",
					project_id: "project-1",
					table_key: "tasks",
					table_name: "任务表",
					description: "任务中文名",
					status: "enabled",
					columns: [
						{
							id: "column-1",
							table_id: "table-1",
							column_key: "title",
							column_name: "任务",
							data_type: "text",
							is_required: true,
							status: "enabled",
							source: "schema",
						},
					],
				},
				isLoading: false,
			}
		}
		if (key[1] === "rows") {
			return {
				data: { total: 1, list: [{ id: "row-1", title: "写测试" }] },
				isLoading: false,
			}
		}
		if (key[1] === "permissions") {
			return {
				data: { table_permissions: [], column_permissions: [], row_permissions: [] },
				isLoading: false,
			}
		}
		return { data: undefined, isLoading: false }
	},
}))

describe("MicroAppDatabasePanelMobile", () => {
	it("opens from the bottom and navigates from table list to mobile table detail", () => {
		render(
			<MicroAppDatabasePanelMobile
				open
				projectId="project-1"
				projectName="Todo App"
				onOpenChange={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("mobile-database-popup")).toHaveAttribute(
			"data-position",
			"bottom",
		)
		expect(screen.getByTestId("mobile-magicbase-table-list")).toBeInTheDocument()
		expect(screen.getByText("任务中文名")).toBeInTheDocument()
		expect(screen.getByText("任务表")).toBeInTheDocument()
		expect(document.body).not.toHaveTextContent("tasks")

		fireEvent.click(screen.getByTestId("mobile-magicbase-table-table-1"))

		expect(
			screen.getByRole("tab", { name: "microAppPage.databasePanel.dataTab" }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole("tab", { name: "microAppPage.databasePanel.permissionsTab" }),
		).not.toBeInTheDocument()
		expect(screen.getByText("任务")).toBeInTheDocument()
		expect(screen.getByText("任务中文名")).toBeInTheDocument()
		expect(screen.getByText("任务表")).toBeInTheDocument()
		expect(screen.getByText("写测试")).toBeInTheDocument()
		expect(document.body).not.toHaveTextContent("tasks")
	})

	it("closes through the mobile popup header", () => {
		const onOpenChange = vi.fn()
		render(
			<MicroAppDatabasePanelMobile open projectId="project-1" onOpenChange={onOpenChange} />,
		)

		fireEvent.click(screen.getByLabelText("common.close"))
		expect(onOpenChange).toHaveBeenCalledWith(false)
	})
})
