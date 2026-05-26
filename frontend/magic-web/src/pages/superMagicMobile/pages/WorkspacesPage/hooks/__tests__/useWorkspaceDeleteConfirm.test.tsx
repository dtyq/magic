import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useWorkspaceDeleteConfirm } from "../useWorkspaceDeleteConfirm"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const map: Record<string, string> = {
				"workspace.deleteWorkspace": "删除工作区",
				"workspace.unnamedWorkspace": "未命名工作区",
				"ui.deleteWorkspaceDescriptionWithoutName": "将被永久删除，包含其中所有项目、话题和文件，此操作无法撤销。",
				"common.cancel": "取消",
				"common.confirm": "确认",
			}
			return map[key] ?? key
		},
	}),
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({
		visible,
		children,
		headerTrailingAction,
	}: {
		visible?: boolean
		children?: React.ReactNode
		headerTrailingAction?: { onClick: () => void; testId?: string }
	}) =>
		visible ? (
			<div>
				<button
					type="button"
					data-testid={headerTrailingAction?.testId}
					onClick={headerTrailingAction?.onClick}
				>
					confirm
				</button>
				{children}
			</div>
		) : null,
}))

function TestHarness({
	onDeleteWorkspace,
}: {
	onDeleteWorkspace: (id: string) => Promise<void>
}) {
	const { requestDeleteWorkspace, deleteConfirmNode } = useWorkspaceDeleteConfirm({
		onDeleteWorkspace,
	})

	return (
		<div>
			<button
				type="button"
				data-testid="trigger-delete"
				onClick={() =>
					requestDeleteWorkspace({
						id: "ws-1",
						name: "测试工作区",
					} as never)
				}
			>
				delete
			</button>
			{deleteConfirmNode}
		</div>
	)
}

describe("useWorkspaceDeleteConfirm", () => {
	it("opens confirm sheet and calls onDeleteWorkspace after confirm", async () => {
		const onDeleteWorkspace = vi.fn(async () => undefined)
		render(<TestHarness onDeleteWorkspace={onDeleteWorkspace} />)

		fireEvent.click(screen.getByTestId("trigger-delete"))
		expect(screen.getByTestId("mobile-workspace-delete-confirm-message")).toHaveTextContent(
			"测试工作区",
		)

		fireEvent.click(screen.getByTestId("mobile-workspace-delete-confirm-confirm"))
		expect(onDeleteWorkspace).toHaveBeenCalledWith("ws-1")
	})
})
