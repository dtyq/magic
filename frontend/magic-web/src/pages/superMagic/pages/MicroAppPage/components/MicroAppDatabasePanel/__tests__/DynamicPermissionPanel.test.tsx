import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import DynamicPermissionPanel from "../DynamicPermissionPanel"

const mocks = vi.hoisted(() => ({
	updateDynamicPermissions: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	initReactI18next: { type: "3rdParty", init: () => undefined },
	useTranslation: () => ({
		t: (key: string, options?: { total?: number }) =>
			options?.total == null ? key : `${key}:${options.total}`,
	}),
}))

vi.mock("@/apis", () => ({
	MagicBaseApi: {
		updateDynamicPermissions: mocks.updateDynamicPermissions,
	},
}))

vi.mock("@/components/shadcn-ui/select", () => ({
	Select: ({
		value,
		onValueChange,
	}: {
		value: string
		onValueChange: (value: string) => void
	}) => (
		<button
			type="button"
			role="combobox"
			onClick={() => onValueChange(value === "public" ? "private_user" : "public")}
		>
			{value}
		</button>
	),
	SelectTrigger: () => null,
	SelectValue: () => null,
	SelectContent: () => null,
	SelectItem: () => null,
}))

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}))

describe("DynamicPermissionPanel", () => {
	beforeEach(() => {
		mocks.updateDynamicPermissions.mockReset()
		mocks.updateDynamicPermissions.mockResolvedValue(undefined)
	})

	it("is editable by default and only shows save after a change", async () => {
		const onDirtyChange = vi.fn()
		const onUpdated = vi.fn()
		render(
			<DynamicPermissionPanel
				projectId="project-1"
				table={{
					id: "table-1",
					project_id: "project-1",
					table_key: "tasks",
					table_name: "Tasks",
					status: "enabled",
					columns: [],
				}}
				columns={[
					{
						id: "column-1",
						table_id: "table-1",
						column_key: "title",
						column_name: "Title",
						data_type: "text",
						is_required: false,
						status: "enabled",
					},
				]}
				canManagePermissions
				onUpdated={onUpdated}
				onDirtyChange={onDirtyChange}
			/>,
		)

		const columnList = screen.getByTestId("magicbase-dynamic-column-list")
		expect(columnList).not.toHaveClass("min-w-[680px]")
		expect(columnList).toHaveTextContent("Title")
		expect(columnList).toHaveTextContent("title")
		expect(columnList).not.toHaveTextContent("text")
		expect(columnList).toHaveTextContent("microAppPage.databasePanel.permissionAction.read")
		expect(columnList).toHaveTextContent("microAppPage.databasePanel.permissionAction.edit")
		expect(screen.getAllByRole("combobox")).toHaveLength(7)
		expect(screen.getAllByRole("combobox").map((control) => control.textContent)).toEqual([
			"public",
			"disabled",
			"public",
			"private_user",
			"private_user",
			"public",
			"private_user",
		])
		expect(screen.queryByText("microAppPage.databasePanel.dynamicSave")).not.toBeInTheDocument()

		const firstScope = screen.getAllByRole("combobox")[0]
		fireEvent.click(firstScope)

		expect(screen.getByText("microAppPage.databasePanel.dynamicSave")).toBeInTheDocument()
		expect(onDirtyChange).toHaveBeenLastCalledWith(true)

		fireEvent.click(firstScope)
		expect(screen.queryByText("microAppPage.databasePanel.dynamicSave")).not.toBeInTheDocument()
		expect(onDirtyChange).toHaveBeenLastCalledWith(false)

		fireEvent.click(firstScope)

		fireEvent.click(screen.getByText("microAppPage.databasePanel.dynamicSave"))

		await waitFor(() => expect(mocks.updateDynamicPermissions).toHaveBeenCalledTimes(1))
		expect(mocks.updateDynamicPermissions).toHaveBeenCalledWith("project-1", "table-1", {
			dynamic_permissions: {
				table: { read_scope: "private_user", insert_scope: "disabled" },
				row: {
					read_scope: "public",
					edit_scope: "private_user",
					delete_scope: "private_user",
				},
				columns: { title: { read_scope: "public", edit_scope: "private_user" } },
			},
		})
		expect(onUpdated).toHaveBeenCalledTimes(1)
		await waitFor(() => {
			expect(
				screen.queryByText("microAppPage.databasePanel.dynamicSave"),
			).not.toBeInTheDocument()
			expect(onDirtyChange).toHaveBeenLastCalledWith(false)
		})
	})
})
