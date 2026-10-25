import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ShareType } from "../../Share/types"
import TopicSharePopover from "../index"

const mocks = vi.hoisted(() => ({
	// react-i18next memoizes `t`, so the mock keeps one identity to avoid re-render loops.
	t: (key: string) => key,
	functionPermissions: {} as Record<string, boolean>,
	isLoading: false,
	getShareInfoByCode: vi.fn(),
	createShareTopic: vi.fn(),
	cancelShareResource: vi.fn(),
	errorToast: vi.fn(),
	successToast: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: mocks.t,
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
	isMobile: false,
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
		getShareInfoByCode: mocks.getShareInfoByCode,
		createShareTopic: mocks.createShareTopic,
		createOrUpdateShareResource: vi.fn(),
		cancelShareResource: mocks.cancelShareResource,
	},
}))

vi.mock("@/hooks/useFunctionPermission", () => ({
	useFunctionPermissions: () => ({
		data: mocks.functionPermissions,
		error: undefined,
		isLoading: mocks.isLoading,
		mutate: vi.fn(),
	}),
}))

vi.mock("@/utils/clipboard-helpers", () => ({
	clipboard: {
		writeText: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: mocks.successToast,
		error: mocks.errorToast,
	},
}))

vi.mock("@/pages/superMagic/components/VipSwitch", () => ({
	VipBadge: () => <span data-testid="vip-badge" />,
	VipSwitch: ({ checked }: { checked?: boolean }) => (
		<input data-testid="vip-switch" readOnly type="checkbox" checked={checked} />
	),
}))

vi.mock("@/pages/superMagic/components/Share/ShareFields", () => ({
	SharePasswordField: () => <div data-testid="share-password-field" />,
}))

vi.mock("@/components/shadcn-ui/popover", () => ({
	Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/pages/superMagicMobile/components/CommonPopup", () => ({
	default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

interface TopicShareFixture {
	share_type?: ShareType
	password?: string
}

const renderTopicSharePopover = (fixture: TopicShareFixture = {}) => {
	mocks.getShareInfoByCode.mockResolvedValue({
		resource_id: "topic-1",
		share_type: fixture.share_type ?? ShareType.None,
		password: fixture.password ?? "",
		extra: {},
	})

	return render(
		<TopicSharePopover open onOpenChange={vi.fn()} topicId="topic-1" topicTitle="Mock topic">
			<button type="button">share</button>
		</TopicSharePopover>,
	)
}

describe("TopicSharePopover share permissions", () => {
	beforeEach(() => {
		mocks.functionPermissions = {}
		mocks.isLoading = false
		mocks.getShareInfoByCode.mockReset()
		mocks.createShareTopic.mockReset()
		mocks.cancelShareResource.mockReset()
		mocks.errorToast.mockReset()
	})

	it("keeps the saved password share editable when password protection is granted", async () => {
		mocks.functionPermissions = {
			"project.share_password": true,
			"project.share_public": true,
			"project.share_team": true,
		}

		renderTopicSharePopover({ share_type: ShareType.PasswordProtected, password: "123456" })

		const passwordSwitch = await screen.findByTestId("topic-share-password-switch")

		expect(passwordSwitch).toHaveAttribute("aria-checked", "true")
		expect(passwordSwitch).toBeEnabled()
		expect(screen.queryByTestId("topic-share-permission-hint")).not.toBeInTheDocument()
		expect(screen.queryByTestId("topic-share-permission-locked-hint")).not.toBeInTheDocument()
		expect(screen.queryByTestId("topic-share-no-method-hint")).not.toBeInTheDocument()
	})

	it("locks the password switch on when the administrator closed public access", async () => {
		mocks.functionPermissions = {
			"project.share_password": true,
			"project.share_public": false,
			"project.share_team": true,
		}

		renderTopicSharePopover({ share_type: ShareType.PasswordProtected, password: "123456" })

		const passwordSwitch = await screen.findByTestId("topic-share-password-switch")

		expect(passwordSwitch).toHaveAttribute("aria-checked", "true")
		expect(passwordSwitch).toBeDisabled()
		expect(screen.getByTestId("topic-share-permission-locked-hint")).toHaveTextContent(
			"share.shareMethodRestrictedByAdmin",
		)
		expect(screen.queryByTestId("topic-share-permission-hint")).not.toBeInTheDocument()
	})

	it("locks the password switch off when the administrator closed password protection", async () => {
		mocks.functionPermissions = {
			"project.share_password": false,
			"project.share_public": true,
			"project.share_team": true,
		}

		renderTopicSharePopover({ share_type: ShareType.Public })

		const passwordSwitch = await screen.findByTestId("topic-share-password-switch")

		expect(passwordSwitch).toHaveAttribute("aria-checked", "false")
		expect(passwordSwitch).toBeDisabled()
		expect(screen.getByTestId("topic-share-permission-locked-hint")).toHaveTextContent(
			"share.shareMethodRestrictedByAdmin",
		)
	})

	it("reports a saved public share whose method was closed afterwards", async () => {
		mocks.functionPermissions = {
			"project.share_password": true,
			"project.share_public": false,
		}

		renderTopicSharePopover({ share_type: ShareType.Public })

		const passwordSwitch = await screen.findByTestId("topic-share-password-switch")

		// The saved method is reported instead of being silently rewritten into the granted one.
		expect(passwordSwitch).toHaveAttribute("aria-checked", "false")
		expect(passwordSwitch).toBeDisabled()
		expect(screen.getByTestId("topic-share-permission-hint")).toHaveTextContent(
			"share.currentShareMethodUnavailable",
		)
	})

	it("hides every detail block when no method is granted", async () => {
		mocks.functionPermissions = {
			"project.share_password": false,
			"project.share_public": false,
		}

		renderTopicSharePopover({ share_type: ShareType.PasswordProtected, password: "123456" })

		const enableSwitch = screen.getByTestId("topic-share-enable-switch")

		expect(enableSwitch).toBeDisabled()
		expect(screen.getByTestId("topic-share-no-method-hint")).toHaveTextContent(
			"share.noAvailableShareMethods",
		)

		// 既有分享的设置是异步加载的，先等它落地，避免断言落在加载前的空状态上。
		await waitFor(() => {
			expect(mocks.getShareInfoByCode).toHaveBeenCalled()
		})
		await act(async () => {
			await Promise.resolve()
		})

		// 管理员关闭全部话题分享方式后，除首行开关外的附属内容对用户没有意义，不再渲染。
		expect(screen.queryByTestId("topic-share-password-switch")).not.toBeInTheDocument()
		expect(screen.queryByTestId("topic-share-permission-hint")).not.toBeInTheDocument()
		expect(screen.queryByTestId("topic-share-permission-locked-hint")).not.toBeInTheDocument()
		expect(screen.queryByTestId("set-is-advanced-open")).not.toBeInTheDocument()
		await waitFor(() => {
			expect(mocks.createShareTopic).not.toHaveBeenCalled()
		})
	})

	it("creates a public share when only public access is granted", async () => {
		mocks.functionPermissions = {
			"project.share_password": false,
			"project.share_public": true,
		}
		mocks.createShareTopic.mockResolvedValue({})

		renderTopicSharePopover()

		const enableSwitch = screen.getByTestId("topic-share-enable-switch")

		fireEvent.click(enableSwitch)

		await waitFor(() => {
			expect(mocks.createShareTopic).toHaveBeenCalledTimes(1)
		})
		expect(mocks.createShareTopic.mock.calls[0][0]).toMatchObject({
			share_type: ShareType.Public,
			password: "",
		})
	})

	it("does not create a password share while the permissions are still loading", async () => {
		mocks.functionPermissions = {
			"project.share_password": false,
			"project.share_public": true,
		}
		mocks.isLoading = true

		renderTopicSharePopover()

		fireEvent.click(screen.getByTestId("topic-share-enable-switch"))

		await waitFor(() => {
			expect(mocks.createShareTopic).not.toHaveBeenCalled()
		})
	})

	it("keeps password protection as the default when it is granted", async () => {
		mocks.functionPermissions = {
			"project.share_password": true,
			"project.share_public": true,
		}
		mocks.createShareTopic.mockResolvedValue({})

		renderTopicSharePopover()

		fireEvent.click(screen.getByTestId("topic-share-enable-switch"))

		await waitFor(() => {
			expect(mocks.createShareTopic).toHaveBeenCalledTimes(1)
		})
		expect(mocks.createShareTopic.mock.calls[0][0].share_type).toBe(ShareType.PasswordProtected)
		expect(mocks.createShareTopic.mock.calls[0][0].password).not.toBe("")
	})

	it("creates a public share when the topic group closed password protection", async () => {
		// The page group leaves both methods open, but a topic share answers to the topic group.
		mocks.functionPermissions = {
			"project.share_password": true,
			"project.share_public": true,
			"project.share_team": true,
			"topic.share_password": false,
			"topic.share_public": true,
		}
		mocks.createShareTopic.mockResolvedValue({})

		renderTopicSharePopover()

		const enableSwitch = screen.getByTestId("topic-share-enable-switch")

		fireEvent.click(enableSwitch)

		await waitFor(() => {
			expect(mocks.createShareTopic).toHaveBeenCalledTimes(1)
		})
		expect(mocks.createShareTopic.mock.calls[0][0]).toMatchObject({
			share_type: ShareType.Public,
			password: "",
		})
	})

	it("locks the password switch off for the topic group restriction", async () => {
		mocks.functionPermissions = {
			"project.share_password": true,
			"project.share_public": true,
			"topic.share_password": false,
			"topic.share_public": true,
		}

		// The saved public share keeps the dialog open on its own method.
		renderTopicSharePopover({ share_type: ShareType.Public })

		const passwordSwitch = await screen.findByTestId("topic-share-password-switch")

		expect(passwordSwitch).toHaveAttribute("aria-checked", "false")
		expect(passwordSwitch).toBeDisabled()
		expect(screen.getByTestId("topic-share-permission-locked-hint")).toHaveTextContent(
			"share.shareMethodRestrictedByAdmin",
		)
	})

	it("creates a password protected share when the topic group only opened password protection", async () => {
		mocks.functionPermissions = {
			"project.share_public": true,
			"topic.share_password": true,
			"topic.share_public": false,
		}
		mocks.createShareTopic.mockResolvedValue({})

		renderTopicSharePopover()

		fireEvent.click(screen.getByTestId("topic-share-enable-switch"))

		await waitFor(() => {
			expect(mocks.createShareTopic).toHaveBeenCalledTimes(1)
		})
		expect(mocks.createShareTopic.mock.calls[0][0].share_type).toBe(ShareType.PasswordProtected)
		expect(mocks.createShareTopic.mock.calls[0][0].password).not.toBe("")
	})

	it("blocks sharing when the topic group closed both methods", async () => {
		mocks.functionPermissions = {
			"project.share_password": true,
			"project.share_public": true,
			"topic.share_password": false,
			"topic.share_public": false,
		}

		renderTopicSharePopover()

		expect(screen.getByTestId("topic-share-enable-switch")).toBeDisabled()
		expect(screen.getByTestId("topic-share-no-method-hint")).toHaveTextContent(
			"share.noAvailableShareMethods",
		)
		await waitFor(() => {
			expect(mocks.createShareTopic).not.toHaveBeenCalled()
		})
	})
})
