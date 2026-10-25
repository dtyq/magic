import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { RowSelectionState } from "@tanstack/react-table"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { AccountListTable } from "../../../enterprise/src/features/platform-account-list/components/account-list-table"
import {
	accountStatus,
	accountType,
	type PlatformAccount,
} from "../../../enterprise/src/features/platform-account-list/types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

const accounts: PlatformAccount[] = [
	{
		account_status: accountStatus.enabled,
		account_type: accountType.human,
		active_organization_count: 2,
		created_at: "2026-03-11 09:24:18",
		display_name: "林悦",
		email: "l***@acme-magic.com",
		magic_id: "919500000000010001",
		nickname: "悦悦",
		organization_count: 2,
		phone: "138****5678",
		real_name: "林悦",
	},
	{
		account_status: accountStatus.disabled,
		account_type: accountType.human,
		active_organization_count: 1,
		created_at: "2026-04-02 14:03:51",
		display_name: "赵衡",
		email: "z***@example.com",
		magic_id: "919500000000010002",
		organization_count: 1,
		phone: "139****1111",
		real_name: "赵衡",
	},
	{
		account_status: accountStatus.enabled,
		account_type: accountType.ai,
		created_at: "2026-09-10 09:00:00",
		display_name: "AI 助手",
		magic_id: "919500000000090001",
		organization_count: 1,
		phone: "138****0002",
		real_name: "AI 助手",
	},
]

function Harness({ canEdit = false }: { canEdit?: boolean }) {
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

	return (
		<>
			<span data-testid="selected-count">
				{Object.values(rowSelection).filter(Boolean).length}
			</span>
			<AccountListTable
				accounts={accounts}
				canEdit={canEdit}
				isLoading={false}
				onDetail={vi.fn()}
				onDisable={vi.fn()}
				onEnable={vi.fn()}
				onRowSelectionChange={setRowSelection}
				rowSelection={rowSelection}
			/>
		</>
	)
}

describe("account list table", () => {
	it("selects a single account with the row checkbox", () => {
		render(<Harness />)

		fireEvent.click(screen.getAllByTestId("account-list-select-row")[0])

		expect(screen.getByTestId("selected-count")).toHaveTextContent("1")
	})

	it("selects and clears every account on the page from the header checkbox", async () => {
		render(<Harness />)

		fireEvent.click(screen.getByTestId("account-list-select-all"))
		await waitFor(() =>
			expect(screen.getByTestId("selected-count")).toHaveTextContent("3"),
		)
		expect(screen.getByTestId("account-list-select-all")).toHaveAttribute(
			"aria-checked",
			"true",
		)

		// The header checkbox is re-created after each state change, so query it again.
		fireEvent.click(screen.getByTestId("account-list-select-all"))
		await waitFor(() =>
			expect(screen.getByTestId("selected-count")).toHaveTextContent("0"),
		)
	})

	it("renders masked contacts, organization counts and the AI badge", () => {
		render(<Harness canEdit />)

		const rows = screen.getAllByTestId("account-list-row")
		expect(rows).toHaveLength(3)
		expect(rows[0]).toHaveTextContent("林悦")
		expect(rows[0]).toHaveTextContent("138****5678")
		expect(rows[1]).toHaveTextContent("accountList.status.disabled")
		expect(rows[2]).toHaveTextContent("accountList.type.ai")
		expect(screen.getAllByTestId("account-list-more-button")).toHaveLength(3)
	})
})
