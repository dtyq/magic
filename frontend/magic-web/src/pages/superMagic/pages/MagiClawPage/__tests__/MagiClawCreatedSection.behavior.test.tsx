import { act, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MAGIC_CLAW_STATUS } from "@/apis/modules/magicClawStatus"
import { MagiClawCreatedSection } from "../MagiClawCreatedSection"
import { MAGI_CLAW_DISPLAY_STATUS } from "../magiClawDisplayStatus"

const { magicClawApiMocks, superMagicApiMocks, confirmMock, toastErrorMock, toastSuccessMock } =
	vi.hoisted(() => ({
		magicClawApiMocks: {
			deleteMagicClaw: vi.fn(),
			getMagicClawSandboxStatus: vi.fn(),
			restartMagicClawSandbox: vi.fn(),
			startMagicClawSandbox: vi.fn(),
			stopMagicClawSandbox: vi.fn(),
			upgradeMagicClawSandbox: vi.fn(),
		},
		superMagicApiMocks: {
			getProjectDetail: vi.fn(),
			getTopicsByProjectId: vi.fn(),
			preWarmSandbox: vi.fn(),
		},
		confirmMock: vi.fn(),
		toastErrorMock: vi.fn(),
		toastSuccessMock: vi.fn(),
	}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("sonner", () => ({
	toast: {
		error: toastErrorMock,
		success: toastSuccessMock,
	},
}))

vi.mock("@/apis", () => ({
	MagicClawApi: magicClawApiMocks,
	SuperMagicApi: superMagicApiMocks,
}))

vi.mock("@/components/base/MagicDropdown", () => ({
	default: function MockMagicDropdown({
		menu,
		children,
	}: {
		menu: { items: Array<Record<string, unknown>> }
		children: ReactNode
	}) {
		return (
			<div>
				{children}
				{menu.items.map((item) => {
					if (item.type === "divider") return null

					return (
						<button
							key={String(item.key)}
							type="button"
							data-testid={String(item["data-testid"])}
							disabled={Boolean(item.disabled)}
							onClick={() => {
								if (typeof item.onClick === "function") item.onClick()
							}}
						>
							{String(item.label)}
						</button>
					)
				})}
			</div>
		)
	},
}))

vi.mock("@/components/shadcn-composed/confirm-dialog", () => ({
	useConfirmDialog: () => ({
		confirm: confirmMock,
		dialog: null,
	}),
}))

vi.mock("../MagiClawStatusBadge", () => ({
	MagiClawStatusBadge: function MockMagiClawStatusBadge({
		status,
		"data-testid": dataTestId,
	}: {
		status?: string | null
		"data-testid"?: string
	}) {
		return <span data-testid={dataTestId}>{status}</span>
	},
}))

vi.mock("../MagiClawTemplateAvatar", () => ({
	MagiClawTemplateAvatar: function MockMagiClawTemplateAvatar() {
		return <span data-testid="magi-claw-template-avatar" />
	},
}))

vi.mock("../MagiClawUpgradeBadge", () => ({
	MagiClawUpgradeBadge: function MockMagiClawUpgradeBadge({
		"data-testid": dataTestId,
		onClick,
		disabled,
	}: {
		"data-testid"?: string
		onClick?: () => void
		disabled?: boolean
	}) {
		return (
			<button type="button" data-testid={dataTestId} disabled={disabled} onClick={onClick}>
				upgrade
			</button>
		)
	},
	shouldShowMagiClawUpgradeBadge: (needUpgrade?: boolean | null) => Boolean(needUpgrade),
}))

afterEach(() => {
	vi.clearAllMocks()
	vi.useRealTimers()
})

async function flushMicrotasks() {
	await Promise.resolve()
	await Promise.resolve()
}

describe("MagiClawCreatedSection behavior", () => {
	beforeEach(() => {
		confirmMock.mockImplementation((opts: { onConfirm?: () => void }) => {
			opts.onConfirm?.()
		})
	})

	it("refreshes list when clicking refresh button", async () => {
		const onRefreshList = vi.fn().mockResolvedValue(undefined)

		render(
			<MagiClawCreatedSection
				claws={[
					{
						id: "1",
						code: "claw-1",
						icon_file_url: null,
						name: "Claw",
						description: null,
						project_id: "project-1",
						template_code: "openclaw",
						status: MAGIC_CLAW_STATUS.RUNNING,
					},
				]}
				listLoading={false}
				isRefreshingList={false}
				onRefreshList={onRefreshList}
				onOpenCreate={vi.fn()}
				onOpenClawPlayground={vi.fn()}
			/>,
		)

		await act(async () => {
			fireEvent.click(screen.getByTestId("magi-claw-refresh-button"))
			await flushMicrotasks()
		})

		expect(onRefreshList).toHaveBeenCalledTimes(1)
	})

	it("starts sandbox by start and polls status without navigation", async () => {
		vi.useFakeTimers()
		superMagicApiMocks.getProjectDetail.mockResolvedValue({
			current_topic_id: "topic-1",
		})
		magicClawApiMocks.startMagicClawSandbox.mockResolvedValue({})
		magicClawApiMocks.getMagicClawSandboxStatus
			.mockResolvedValueOnce({ status: MAGIC_CLAW_STATUS.PENDING })
			.mockResolvedValueOnce({ status: MAGIC_CLAW_STATUS.RUNNING })

		const onRefreshList = vi.fn().mockResolvedValue(undefined)
		const onOpenClawPlayground = vi.fn()

		render(
			<MagiClawCreatedSection
				claws={[
					{
						id: "1",
						code: "claw-1",
						icon_file_url: null,
						name: "Claw",
						description: null,
						project_id: "project-1",
						template_code: "openclaw",
						status: MAGIC_CLAW_STATUS.EXITED,
					},
				]}
				listLoading={false}
				onRefreshList={onRefreshList}
				onOpenCreate={vi.fn()}
				onOpenClawPlayground={onOpenClawPlayground}
			/>,
		)

		await act(async () => {
			fireEvent.click(screen.getByTestId("magi-claw-created-item-start-claw-1"))
			await flushMicrotasks()
		})

		expect(magicClawApiMocks.startMagicClawSandbox).toHaveBeenCalledWith(
			{ topic_id: "topic-1" },
			{ enableErrorMessagePrompt: false },
		)
		expect(onOpenClawPlayground).not.toHaveBeenCalled()
		expect(screen.getByTestId("magi-claw-created-item-status-claw-1")).toHaveTextContent(
			MAGIC_CLAW_STATUS.PENDING,
		)
		expect(magicClawApiMocks.getMagicClawSandboxStatus).toHaveBeenCalledTimes(1)

		await act(async () => {
			await vi.advanceTimersByTimeAsync(5_000)
			await flushMicrotasks()
		})

		expect(magicClawApiMocks.getMagicClawSandboxStatus).toHaveBeenCalledTimes(2)
		expect(screen.getByTestId("magi-claw-created-item-status-claw-1")).toHaveTextContent(
			MAGIC_CLAW_STATUS.RUNNING,
		)
		expect(onRefreshList).toHaveBeenCalled()
	})

	it("calls sandbox upgrade when clicking upgrade-available badge while running", async () => {
		superMagicApiMocks.getProjectDetail.mockResolvedValue({
			current_topic_id: "topic-1",
		})
		magicClawApiMocks.upgradeMagicClawSandbox.mockResolvedValue({})

		const onRefreshList = vi.fn().mockResolvedValue(undefined)

		render(
			<MagiClawCreatedSection
				claws={[
					{
						id: "1",
						code: "claw-1",
						icon_file_url: null,
						name: "Claw",
						description: null,
						project_id: "project-1",
						template_code: "openclaw",
						status: MAGIC_CLAW_STATUS.RUNNING,
						need_upgrade: true,
					},
				]}
				listLoading={false}
				onRefreshList={onRefreshList}
				onOpenCreate={vi.fn()}
				onOpenClawPlayground={vi.fn()}
			/>,
		)

		await act(async () => {
			fireEvent.click(screen.getByTestId("magi-claw-created-item-upgrade-claw-1"))
			await flushMicrotasks()
		})

		expect(magicClawApiMocks.upgradeMagicClawSandbox).toHaveBeenCalledWith({
			topic_id: "topic-1",
		})
	})

	it("calls sandbox restart when clicking restart action", async () => {
		superMagicApiMocks.getProjectDetail.mockResolvedValue({
			current_topic_id: "topic-1",
		})
		let resolveRestartRequest: (() => void) | undefined
		magicClawApiMocks.restartMagicClawSandbox.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveRestartRequest = () => resolve({})
				}),
		)

		const onRefreshList = vi.fn().mockResolvedValue(undefined)

		render(
			<MagiClawCreatedSection
				claws={[
					{
						id: "1",
						code: "claw-1",
						icon_file_url: null,
						name: "Claw",
						description: null,
						project_id: "project-1",
						template_code: "openclaw",
						status: MAGIC_CLAW_STATUS.RUNNING,
					},
				]}
				listLoading={false}
				onRefreshList={onRefreshList}
				onOpenCreate={vi.fn()}
				onOpenClawPlayground={vi.fn()}
			/>,
		)

		await act(async () => {
			fireEvent.click(screen.getByTestId("magi-claw-created-item-restart-claw-1"))
			await flushMicrotasks()
		})

		expect(screen.getByTestId("magi-claw-created-item-status-claw-1")).toHaveTextContent(
			MAGI_CLAW_DISPLAY_STATUS.RESTARTING,
		)
		expect(magicClawApiMocks.restartMagicClawSandbox).toHaveBeenCalledWith({
			topic_id: "topic-1",
		})
		expect(magicClawApiMocks.upgradeMagicClawSandbox).not.toHaveBeenCalled()

		await act(async () => {
			resolveRestartRequest?.()
			await flushMicrotasks()
		})
	})
})
