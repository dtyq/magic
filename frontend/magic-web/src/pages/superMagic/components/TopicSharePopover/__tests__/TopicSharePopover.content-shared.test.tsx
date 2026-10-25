import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import TopicSharePopover from "../index"
import { ResourceType, ShareType } from "../../Share/types"

const trackMock = vi.hoisted(() => vi.fn())
const translateMock = vi.hoisted(() => vi.fn((key: string) => key))
const apiMocks = vi.hoisted(() => ({
	getShareInfoByCode: vi.fn(),
	createShareTopic: vi.fn(),
	createOrUpdateShareResource: vi.fn(),
	cancelShareResource: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: translateMock,
	}),
}))

vi.mock("ahooks", async () => {
	const actual = await vi.importActual<typeof import("ahooks")>("ahooks")
	return {
		...actual,
		useResponsive: () => ({ md: true }),
	}
})

vi.mock("@/utils/devices", () => ({
	isMagicApp: false,
	isNoHoverCoarsePointer: () => false,
}))

vi.mock("@/services/analytics", () => ({
	analyticsService: { report: trackMock },
}))

vi.mock("@/apis", () => ({
	FUNCTION_PERMISSION_CODE: {
		MicroAppSharePassword: "micro_app.share_password",
		MicroAppSharePublic: "micro_app.share_public",
		MicroAppShareTeam: "micro_app.share_team",
		ProjectSharePassword: "project.share_password",
		ProjectSharePublic: "project.share_public",
		ProjectShareTeam: "project.share_team",
		TopicSharePassword: "topic.share_password",
		TopicSharePublic: "topic.share_public",
	},
	SuperMagicApi: {
		getShareInfoByCode: apiMocks.getShareInfoByCode,
		createShareTopic: apiMocks.createShareTopic,
		createOrUpdateShareResource: apiMocks.createOrUpdateShareResource,
		cancelShareResource: apiMocks.cancelShareResource,
	},
}))

vi.mock("@/hooks/useFunctionPermission", () => ({
	useFunctionPermissions: () => ({
		data: {
			"micro_app.share_password": true,
			"micro_app.share_public": true,
			"micro_app.share_team": true,
			"project.share_password": true,
			"project.share_public": true,
			"project.share_team": true,
			"topic.share_password": true,
			"topic.share_public": true,
		},
		error: undefined,
		isLoading: false,
		mutate: vi.fn(),
	}),
}))

vi.mock("@/utils/clipboard-helpers", () => ({
	clipboard: {
		writeText: vi.fn().mockResolvedValue(undefined),
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/components/VipSwitch", () => ({
	VipBadge: () => <span data-testid="vip-badge" />,
	VipSwitch: ({
		checked,
		onChange,
	}: {
		checked?: boolean
		onChange?: (checked: boolean) => void
	}) => (
		<button
			type="button"
			data-testid="vip-switch"
			aria-pressed={checked}
			onClick={() => onChange?.(!checked)}
		/>
	),
}))

vi.mock("@/pages/superMagic/components/Share/ShareFields", () => ({
	SharePasswordField: ({ onReset }: { onReset?: () => void }) => (
		<button type="button" data-testid="reset-password" onClick={() => onReset?.()}>
			reset
		</button>
	),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("@/components/shadcn-ui/switch", () => ({
	Switch: ({
		checked,
		onCheckedChange,
		...props
	}: {
		checked?: boolean
		onCheckedChange?: (checked: boolean) => void
	}) => (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={() => onCheckedChange?.(!checked)}
			{...props}
		/>
	),
}))

vi.mock("../styles", () => ({
	useStyles: () => ({
		styles: {
			container: "container",
			switchRow: "switch-row",
			switchLabel: "switch-label",
			switchTitle: "switch-title",
			switchDescription: "switch-description",
			fieldGroup: "field-group",
			fieldLabel: "field-label",
			advancedSection: "advanced-section",
			advancedHeader: "advanced-header",
			advancedTitle: "advanced-title",
			advancedContent: "advanced-content",
		},
	}),
}))

vi.mock("@/components/shadcn-ui/popover", () => ({
	Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

function renderPopover() {
	return render(
		<TopicSharePopover
			open
			onOpenChange={vi.fn()}
			topicId="topic-desktop"
			topicTitle="Desktop topic"
		>
			<button type="button">share</button>
		</TopicSharePopover>,
	)
}

async function enableShare() {
	await waitFor(() => {
		expect(apiMocks.getShareInfoByCode).toHaveBeenCalled()
	})
	fireEvent.click(screen.getByTestId("topic-share-enable-switch"))
	await waitFor(() => {
		expect(screen.getByTestId("topic-share-password-switch")).toBeInTheDocument()
	})
}

describe("TopicSharePopover content_share_attempted", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		apiMocks.getShareInfoByCode.mockResolvedValue(null)
		apiMocks.createShareTopic.mockResolvedValue({ code: 1000 })
		apiMocks.createOrUpdateShareResource.mockResolvedValue({ code: 1000 })
	})

	it("首次开启话题分享时上报 content_share_attempted", async () => {
		renderPopover()
		await enableShare()

		expect(apiMocks.createShareTopic).toHaveBeenCalledTimes(1)
		expect(trackMock).toHaveBeenCalledTimes(1)
		expect(trackMock).toHaveBeenCalledWith("content_share_attempted", {
			resourceType: ResourceType.Topic,
		})
	})

	it("编辑密码或高级设置时不上报，且同一入口只报一次", async () => {
		renderPopover()
		await enableShare()
		expect(trackMock).toHaveBeenCalledTimes(1)

		fireEvent.click(screen.getByTestId("topic-share-password-switch"))
		await waitFor(() => {
			expect(apiMocks.createShareTopic).toHaveBeenCalledTimes(2)
		})
		expect(trackMock).toHaveBeenCalledTimes(1)

		fireEvent.click(screen.getByTestId("set-is-advanced-open"))
		fireEvent.click(screen.getAllByTestId("vip-switch")[0])
		await waitFor(() => {
			expect(apiMocks.createOrUpdateShareResource).toHaveBeenCalledTimes(1)
		})
		expect(trackMock).toHaveBeenCalledTimes(1)
	})

	it("开启话题分享失败时仍上报 content_share_attempted", async () => {
		apiMocks.createShareTopic.mockRejectedValue(new Error("create failed"))
		renderPopover()

		await waitFor(() => {
			expect(apiMocks.getShareInfoByCode).toHaveBeenCalled()
		})

		fireEvent.click(screen.getByTestId("topic-share-enable-switch"))

		await waitFor(() => {
			expect(apiMocks.createShareTopic).toHaveBeenCalled()
		})
		expect(trackMock).toHaveBeenCalledWith("content_share_attempted", {
			resourceType: ResourceType.Topic,
		})
		expect(screen.queryByTestId("topic-share-password-switch")).not.toBeInTheDocument()
	})

	it("已有分享处于关闭状态时再次开启仍上报 content_share_attempted", async () => {
		apiMocks.getShareInfoByCode.mockResolvedValue({
			resource_id: "topic-desktop",
			share_type: ShareType.None,
			extra: {},
		})
		renderPopover()

		await waitFor(() => expect(apiMocks.getShareInfoByCode).toHaveBeenCalled())
		fireEvent.click(screen.getByTestId("topic-share-enable-switch"))

		await waitFor(() => expect(apiMocks.createShareTopic).toHaveBeenCalled())
		expect(trackMock).toHaveBeenCalledTimes(1)
		expect(trackMock).toHaveBeenCalledWith("content_share_attempted", {
			resourceType: ResourceType.Topic,
		})
	})

	it("已开启的话题分享改密码不上报 content_share_attempted", async () => {
		apiMocks.getShareInfoByCode.mockResolvedValue({
			resource_id: "topic-desktop",
			share_type: ShareType.PasswordProtected,
			password: "abc123",
			extra: {},
		})
		renderPopover()

		await waitFor(() => {
			expect(screen.getByTestId("topic-share-password-switch")).toBeInTheDocument()
		})
		fireEvent.click(screen.getByTestId("topic-share-password-switch"))
		await waitFor(() => {
			expect(apiMocks.createShareTopic).toHaveBeenCalled()
		})
		expect(trackMock).not.toHaveBeenCalled()
	})
})
