import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	AccountStatusDialog,
	type AccountStatusDialogValues,
} from "../../../enterprise/src/features/platform-account-list/components/account-status-dialog"
import {
	accountStatus,
	accountType,
	type AccountStatusPreview,
	type PlatformAccount,
} from "../../../enterprise/src/features/platform-account-list/types"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const previewHolder = vi.hoisted(() => ({
	value: { data: undefined, isLoading: false } as {
		data?: AccountStatusPreview
		isLoading: boolean
	},
}))

vi.mock("@magic-admin-v2/features/platform-account-list/queries", () => ({
	useAccountStatusPreviewQuery: () => previewHolder.value,
}))

const singleAccount: PlatformAccount = {
	account_status: accountStatus.enabled,
	account_type: accountType.human,
	display_name: "林悦",
	magic_id: "919500000000010001",
	organization_count: 2,
	phone: "138****5678",
}

const batchAccounts: PlatformAccount[] = ["0001", "0002", "0003", "0004"].map((suffix) => ({
	account_status: accountStatus.enabled,
	account_type: accountType.human,
	display_name: `账号${suffix}`,
	magic_id: `91950000000001${suffix}`,
	organization_count: 1,
}))

function renderDialog(
	overrides: Partial<{
		accounts: PlatformAccount[]
		mode: "disable" | "enable"
		onSubmit: (values: AccountStatusDialogValues) => Promise<void>
	}> = {},
) {
	const onSubmit = overrides.onSubmit ?? vi.fn().mockResolvedValue(undefined)

	render(
		<AccountStatusDialog
			accounts={overrides.accounts ?? [singleAccount]}
			isOpen
			isPending={false}
			mode={overrides.mode ?? "disable"}
			onClose={vi.fn()}
			onSubmit={onSubmit}
		/>,
	)

	return { onSubmit }
}

describe("account status dialog", () => {
	beforeEach(() => {
		previewHolder.value = { data: undefined, isLoading: false }
	})

	it("allows disabling without a reason", async () => {
		const { onSubmit } = renderDialog()

		fireEvent.click(screen.getByTestId("account-status-submit-button"))

		await waitFor(() =>
			expect(screen.getByTestId("account-status-confirm-dialog")).toBeInTheDocument(),
		)
		expect(
			screen.queryByText("accountList.validation.reasonTooLong"),
		).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("account-status-confirm-button"))

		await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ reason: "" }))
	})

	it("submits the trimmed reason after confirmation", async () => {
		const { onSubmit } = renderDialog()

		fireEvent.change(screen.getByTestId("account-status-reason-input"), {
			target: { value: "  脚本刷邀请积分  " },
		})
		fireEvent.click(screen.getByTestId("account-status-submit-button"))

		await waitFor(() =>
			expect(screen.getByTestId("account-status-confirm-dialog")).toBeInTheDocument(),
		)

		fireEvent.click(screen.getByTestId("account-status-confirm-button"))

		await waitFor(() =>
			expect(onSubmit).toHaveBeenCalledWith({ reason: "脚本刷邀请积分" }),
		)
	})

	it("hides the reason field and shows the preview for enable mode", () => {
		previewHolder.value = {
			data: {
				active_api_key_count: 4,
				active_token_count: 6,
				affected_organization_count: 2,
				affected_user_count: 2,
				current_status: accountStatus.disabled,
				target_status: accountStatus.enabled,
			},
			isLoading: false,
		}

		renderDialog({ mode: "enable" })

		expect(screen.queryByTestId("account-status-reason-input")).not.toBeInTheDocument()
		expect(screen.getByTestId("account-status-preview")).toHaveTextContent(
			"accountList.preview.organizations",
		)
		expect(screen.getByTestId("account-status-preview")).toHaveTextContent("6")
	})

	it("summarizes batch targets without a per-account preview", () => {
		renderDialog({ accounts: batchAccounts })

		expect(screen.getByTestId("account-status-dialog")).toHaveTextContent(
			"accountList.dialog.selectedCount",
		)
		expect(screen.getByTestId("account-status-dialog")).toHaveTextContent(
			"accountList.dialog.batchHint",
		)
		expect(screen.queryByTestId("account-status-preview")).not.toBeInTheDocument()
	})
})
