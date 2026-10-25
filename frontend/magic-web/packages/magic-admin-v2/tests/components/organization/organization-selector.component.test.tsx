import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
	MemberSelectorDialog,
	type OrganizationSelectorLoadChildren,
} from "../../../src/components/organization-selectors"

vi.mock("react-i18next", () => {
	const messages: Record<string, string> = {
		"organizationSelector.action.cancel": "取消",
		"organizationSelector.action.clearSearch": "清空搜索",
		"organizationSelector.action.confirm": "确认添加",
		"organizationSelector.action.selectNode": "选择 {{name}}",
		"organizationSelector.member.description": "选择成员",
		"organizationSelector.member.searchPlaceholder": "搜索成员",
		"organizationSelector.member.title": "选择成员",
		"organizationSelector.root": "组织架构",
		"organizationSelector.selection.convertDepartmentsHint": "部门将转换为成员",
		"organizationSelector.selection.departmentPart": "，{{count}} 个部门",
		"organizationSelector.selection.none": "尚未选择",
		"organizationSelector.selection.summary": "已选 {{total}} 项",
		"organizationSelector.state.empty": "暂无数据",
		"organizationSelector.state.loading": "加载中",
	}
	const translate = (key: string, values?: Record<string, unknown>) =>
		Object.entries(values ?? {}).reduce(
			(message, [name, value]) => message.split(`{{${name}}}`).join(String(value)),
			messages[key] ?? key,
		)

	return {
		useTranslation: () => ({ t: translate }),
	}
})

describe("organization member selector", () => {
	it("recursively converts selected departments to deduplicated selectable users", async () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined)
		const onOpenChange = vi.fn()
		const loadChildren = vi.fn<OrganizationSelectorLoadChildren>(async ({ parentId }) => {
			if (parentId === "-1") {
				return [
					{
						id: "department-1",
						name: "研发部",
						type: "department",
						hasChildren: true,
					},
				]
			}
			if (parentId === "department-1") {
				return [
					{ id: "user-1", name: "张三", type: "user", disabled: true },
					{
						id: "department-2",
						name: "前端组",
						type: "department",
						hasChildren: true,
					},
				]
			}
			return [
				{ id: "user-1", name: "张三", type: "user", disabled: true },
				{ id: "user-2", name: "李四", type: "user" },
			]
		})

		render(
			<MemberSelectorDialog
				loadChildren={loadChildren}
				onConfirm={onConfirm}
				onOpenChange={onOpenChange}
				open
			/>,
		)

		fireEvent.click(await screen.findByRole("checkbox", { name: "选择 研发部" }))

		const actionButtons = [
			screen.getByRole("button", { name: "取消" }),
			screen.getByRole("button", { name: "确认添加" }),
		]
		const actionButtonGroup = actionButtons[0].parentElement
		const dialogFooter = actionButtonGroup?.parentElement
		expect(actionButtonGroup).toHaveClass("flex-row")
		expect(actionButtonGroup).not.toHaveClass("flex-col-reverse")
		expect(dialogFooter).toHaveAttribute("data-slot", "dialog-footer")
		expect(dialogFooter).toHaveClass("flex-row", "justify-between")
		expect(dialogFooter).not.toHaveClass("flex-col-reverse")
		fireEvent.click(screen.getByRole("button", { name: "确认添加" }))

		await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
		expect(onConfirm).toHaveBeenCalledWith([
			expect.objectContaining({ id: "user-2", type: "user" }),
		])
		expect(onOpenChange).toHaveBeenCalledWith(false)
		expect(loadChildren).toHaveBeenCalledWith(
			expect.objectContaining({ parentId: "department-1", includeMembers: true }),
		)
		expect(loadChildren).toHaveBeenCalledWith(
			expect.objectContaining({ parentId: "department-2", includeMembers: true }),
		)
	})
})
