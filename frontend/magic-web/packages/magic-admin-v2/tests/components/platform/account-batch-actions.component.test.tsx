import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AccountBatchActions } from "../../../enterprise/src/features/platform-account-list/components/account-batch-actions"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

describe("account batch actions", () => {
	it("stays hidden until an account is selected", () => {
		render(
			<AccountBatchActions
				disabledCount={0}
				enabledCount={0}
				isPending={false}
				onClear={vi.fn()}
				onDisable={vi.fn()}
				onEnable={vi.fn()}
				selectedCount={0}
			/>,
		)

		expect(screen.queryByTestId("account-list-batch-actions")).not.toBeInTheDocument()
	})

	it("enables only the action that matches the selected account status", () => {
		render(
			<AccountBatchActions
				disabledCount={2}
				enabledCount={0}
				isPending={false}
				onClear={vi.fn()}
				onDisable={vi.fn()}
				onEnable={vi.fn()}
				selectedCount={2}
			/>,
		)

		expect(screen.getByTestId("account-list-batch-disable-button")).toBeDisabled()
		expect(screen.getByTestId("account-list-batch-enable-button")).toBeEnabled()
	})

	it("forwards disable, enable and clear intents to the page", () => {
		const onDisable = vi.fn()
		const onEnable = vi.fn()
		const onClear = vi.fn()

		render(
			<AccountBatchActions
				disabledCount={1}
				enabledCount={1}
				isPending={false}
				onClear={onClear}
				onDisable={onDisable}
				onEnable={onEnable}
				selectedCount={2}
			/>,
		)

		fireEvent.click(screen.getByTestId("account-list-batch-disable-button"))
		fireEvent.click(screen.getByTestId("account-list-batch-enable-button"))
		fireEvent.click(screen.getByTestId("account-list-batch-clear-button"))

		expect(onDisable).toHaveBeenCalledTimes(1)
		expect(onEnable).toHaveBeenCalledTimes(1)
		expect(onClear).toHaveBeenCalledTimes(1)
	})
})
