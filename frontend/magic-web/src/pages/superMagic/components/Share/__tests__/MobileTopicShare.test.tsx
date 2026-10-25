import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	canUseNativeShare,
	shareToNativeTarget,
} from "@/pages/superMagic/components/Share/utils/nativeShare"
import { clipboard } from "@/utils/clipboard-helpers"
import MobileTopicShare from "../MobileTopicShare"
import { ResourceType, ShareType } from "../types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: functionPermissionMocks.t,
	}),
}))

vi.mock("ahooks", async () => {
	const React = await vi.importActual<typeof import("react")>("react")
	return {
		useUpdateEffect: (effect: React.EffectCallback, deps?: React.DependencyList) => {
			const mounted = React.useRef(false)
			React.useEffect(() => {
				if (mounted.current) return effect()
				mounted.current = true
				return undefined
			}, deps)
		},
	}
})

vi.mock("@/utils/clipboard-helpers", () => ({
	clipboard: {
		writeText: vi.fn(),
	},
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			userInfo: {
				nickname: "Fictional Share Tester",
				real_name: "Fictional Backup Tester",
			},
		},
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/components/Share/utils/nativeShare", () => ({
	canUseNativeShare: vi.fn(() => false),
	shareToNativeTarget: vi.fn(),
}))

const trackMock = vi.hoisted(() => vi.fn())

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
		createOrUpdateShareResource: vi.fn(),
		cancelShareResource: vi.fn(),
	},
}))

const functionPermissionMocks = vi.hoisted(() => ({
	// react-i18next memoizes `t`, so the mock keeps one identity for every render.
	t: (key: string) => key,
	permissions: {} as Record<string, boolean>,
	isLoading: false,
}))

vi.mock("@/hooks/useFunctionPermission", () => ({
	useFunctionPermissions: () => ({
		data: functionPermissionMocks.permissions,
		error: undefined,
		isLoading: functionPermissionMocks.isLoading,
		mutate: vi.fn(),
	}),
}))

describe("MobileTopicShare", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Share methods stay unrestricted unless a case narrows them down.
		functionPermissionMocks.permissions = {
			"project.share_password": true,
			"project.share_public": true,
			"project.share_team": true,
		}
		functionPermissionMocks.isLoading = false
		vi.mocked(canUseNativeShare).mockReturnValue(false)
		vi.mocked(shareToNativeTarget).mockResolvedValue("shared")
	})

	it("未开启分享时只展示主开关卡片，不展示链接和高级设置", () => {
		render(
			<MobileTopicShare
				type={ShareType.None}
				shareContext={{ resource_id: "topic-1" }}
				extraData={{ passwordEnabled: true, password: "abc123" }}
				setExtraData={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("mobile-topic-share-toggle-card")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-topic-share-link-card")).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("mobile-topic-share-advanced-settings-card"),
		).not.toBeInTheDocument()
	})

	it("公开分享时只展示链接卡片和密码保护开关，不展示密码卡片", () => {
		render(
			<MobileTopicShare
				type={ShareType.Public}
				shareContext={{
					resource_id: "topic-1",
					share_url: "https://example.com/topic-1",
				}}
				extraData={{
					passwordEnabled: false,
					shareUrl: "https://example.com/topic-1",
				}}
				setExtraData={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("mobile-topic-share-link-card")).toHaveTextContent(
			"https://example.com/topic-1",
		)
		expect(screen.getByTestId("mobile-topic-share-password-toggle-row")).toBeInTheDocument()
		expect(screen.queryByTestId("mobile-topic-share-password-card")).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("mobile-topic-share-advanced-settings-card"),
		).not.toBeInTheDocument()
	})

	it("密码分享时展示密码卡片，但不再提供复制与重置入口", () => {
		render(
			<MobileTopicShare
				type={ShareType.PasswordProtected}
				shareContext={{ resource_id: "topic-1" }}
				extraData={{
					passwordEnabled: true,
					password: "abc123",
					shareUrl: "https://example.com/topic-1?password=abc123",
				}}
				setExtraData={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("mobile-topic-share-password-card")).toBeInTheDocument()
		expect(
			screen.queryByTestId("mobile-topic-share-password-copy-button"),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("mobile-topic-share-password-reset-button"),
		).not.toBeInTheDocument()
	})

	it("点击复制链接按钮会复制 PC 对齐的多行话题分享文案", () => {
		render(
			<MobileTopicShare
				type={ShareType.Public}
				topicTitle="测试话题"
				shareContext={{
					resource_id: "topic-1",
					share_url: "https://example.com/topic-1",
				}}
				extraData={{
					passwordEnabled: false,
					shareUrl: "https://example.com/topic-1",
				}}
				setExtraData={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-topic-share-copy-link-button"))
		const copiedText = String(vi.mocked(clipboard.writeText).mock.calls[0]?.[0])
		expect(copiedText).toContain("share.shareMessageTopic")
		expect(copiedText).toContain("share.shareMessageTopicLink")
		expect(copiedText).toContain("share.createdBy.footerLine")
		expect(copiedText).not.toBe("https://example.com/topic-1")
		expect(copiedText.split("\n").length).toBeGreaterThan(3)
	})

	it("浏览器不支持系统分享时不展示分享至按钮", () => {
		vi.mocked(canUseNativeShare).mockReturnValue(false)

		render(
			<MobileTopicShare
				type={ShareType.Public}
				topicTitle="Fictional Topic Unsupported"
				shareContext={{
					resource_id: "fictional-topic-unsupported",
					share_url: "https://example.invalid/topic-unsupported",
				}}
				extraData={{
					passwordEnabled: false,
					shareUrl: "https://example.invalid/topic-unsupported",
				}}
				setExtraData={vi.fn()}
			/>,
		)

		expect(
			screen.queryByTestId("mobile-topic-share-native-share-button"),
		).not.toBeInTheDocument()
	})

	it("浏览器支持系统分享时展示分享至按钮且复制链接保持纯文字", () => {
		vi.mocked(canUseNativeShare).mockReturnValue(true)

		render(
			<MobileTopicShare
				type={ShareType.Public}
				topicTitle="Fictional Topic Visual"
				shareContext={{
					resource_id: "fictional-topic-visual",
					share_url: "https://example.invalid/topic-visual",
				}}
				extraData={{
					passwordEnabled: false,
					shareUrl: "https://example.invalid/topic-visual",
				}}
				setExtraData={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("mobile-topic-share-native-share-button")).toHaveTextContent(
			"share.shareToSystem",
		)
		expect(
			screen.getByTestId("mobile-topic-share-native-share-button").querySelector("svg"),
		).toBeInTheDocument()
		expect(
			screen.getByTestId("mobile-topic-share-copy-link-button").querySelector("svg"),
		).toBeNull()
	})

	it("点击分享至按钮会使用已生成的话题分享文案调用系统分享", async () => {
		vi.mocked(canUseNativeShare).mockReturnValue(true)

		render(
			<MobileTopicShare
				type={ShareType.Public}
				topicTitle="Fictional Topic Native"
				shareContext={{
					resource_id: "fictional-topic-native",
					share_url: "https://example.invalid/topic-native",
				}}
				extraData={{
					passwordEnabled: false,
					shareUrl: "https://example.invalid/topic-native",
				}}
				setExtraData={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-topic-share-native-share-button"))

		await waitFor(() => {
			expect(shareToNativeTarget).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "Fictional Topic Native",
					url: "https://example.invalid/topic-native",
				}),
			)
		})
		const payload = vi.mocked(shareToNativeTarget).mock.calls[0]?.[0]
		expect(payload?.text).toContain("share.shareMessageTopic")
		expect(payload?.text).toContain("share.shareMessageTopicLink")
	})

	it("系统分享失败时展示失败提示", async () => {
		vi.mocked(canUseNativeShare).mockReturnValue(true)
		vi.mocked(shareToNativeTarget).mockResolvedValue("failed")

		render(
			<MobileTopicShare
				type={ShareType.Public}
				topicTitle="Fictional Topic Failed"
				shareContext={{
					resource_id: "fictional-topic-failed",
					share_url: "https://example.invalid/topic-failed",
				}}
				extraData={{
					passwordEnabled: false,
					shareUrl: "https://example.invalid/topic-failed",
				}}
				setExtraData={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-topic-share-native-share-button"))

		await waitFor(() => {
			expect(magicToast.error).toHaveBeenCalledWith("share.nativeShareFailed")
		})
	})

	it("开启密码保护时复制文案中的链接仍包含 password 参数", () => {
		render(
			<MobileTopicShare
				type={ShareType.PasswordProtected}
				topicTitle="测试话题"
				shareContext={{
					resource_id: "topic-1",
					share_url: "https://example.com/topic-1?password=abc123",
				}}
				extraData={{
					passwordEnabled: true,
					password: "abc123",
					shareUrl: "https://example.com/topic-1?password=abc123",
				}}
				setExtraData={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-topic-share-copy-link-button"))
		const copiedText = String(vi.mocked(clipboard.writeText).mock.calls[0]?.[0])
		expect(copiedText).toContain("share.shareMessageTopic")
		expect(copiedText).toContain("share.shareMessageTopicLink")
		expect(copiedText).not.toBe("https://example.com/topic-1?password=abc123")
		expect(copiedText.split("\n").length).toBeGreaterThan(3)
	})

	it("点击密码保护行会切换为密码分享并调用保存接口", async () => {
		render(
			<MobileTopicShare
				type={ShareType.Public}
				shareContext={{ resource_id: "topic-1" }}
				extraData={{ passwordEnabled: false, password: "abc123" }}
				setExtraData={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-topic-share-password-toggle-row"))

		await waitFor(() => {
			expect(SuperMagicApi.createOrUpdateShareResource).toHaveBeenCalled()
		})
	})

	it("关闭分享成功后停留当前页，不自动关闭弹层", async () => {
		const onClose = vi.fn()
		vi.mocked(SuperMagicApi.cancelShareResource).mockResolvedValue(undefined as never)

		render(
			<MobileTopicShare
				type={ShareType.Public}
				shareContext={{ resource_id: "topic-1" }}
				extraData={{ passwordEnabled: false }}
				setExtraData={vi.fn()}
				onClose={onClose}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-topic-share-toggle-row"))

		await waitFor(() => {
			expect(SuperMagicApi.cancelShareResource).toHaveBeenCalledWith({
				resourceId: "topic-1",
			})
		})

		expect(onClose).not.toHaveBeenCalled()
	})

	it("管理员关闭公开访问时锁定密码保护并提示限制", () => {
		functionPermissionMocks.permissions = {
			"project.share_password": true,
			"project.share_public": false,
			"project.share_team": true,
		}

		render(
			<MobileTopicShare
				type={ShareType.PasswordProtected}
				shareContext={{ resource_id: "topic-1" }}
				extraData={{ passwordEnabled: true, password: "abc123" }}
				setExtraData={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("mobile-topic-share-password-toggle-row")).toHaveAttribute(
			"aria-disabled",
			"true",
		)
		expect(
			screen.getByTestId("mobile-topic-share-password-toggle-row").querySelector("button"),
		).toBeDisabled()
		expect(screen.getByTestId("mobile-topic-share-permission-locked-hint")).toHaveTextContent(
			"share.shareMethodRestrictedByAdmin",
		)
	})

	it("保存的分享方式被管理员关闭后点击不再写入接口", async () => {
		functionPermissionMocks.permissions = {
			"project.share_password": true,
			"project.share_public": false,
		}

		render(
			<MobileTopicShare
				type={ShareType.Public}
				shareContext={{ resource_id: "topic-1" }}
				extraData={{ passwordEnabled: false }}
				setExtraData={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("mobile-topic-share-permission-hint")).toHaveTextContent(
			"share.currentShareMethodUnavailable",
		)

		fireEvent.click(screen.getByTestId("mobile-topic-share-password-toggle-row"))

		await waitFor(() => {
			expect(SuperMagicApi.createOrUpdateShareResource).not.toHaveBeenCalled()
		})
	})

	it("管理员未开放任何分享方式时禁用主开关", async () => {
		functionPermissionMocks.permissions = {}

		render(
			<MobileTopicShare
				type={ShareType.Public}
				shareContext={{
					resource_id: "topic-1",
					share_url: "https://example.com/topic-1",
				}}
				extraData={{
					passwordEnabled: false,
					shareUrl: "https://example.com/topic-1",
				}}
				setExtraData={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("mobile-topic-share-toggle-row")).toHaveAttribute(
			"aria-disabled",
			"true",
		)
		expect(screen.getByTestId("mobile-topic-share-no-method-hint")).toHaveTextContent(
			"share.noAvailableShareMethods",
		)
		expect(screen.queryByTestId("mobile-topic-share-link-card")).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("mobile-topic-share-password-toggle-row"),
		).not.toBeInTheDocument()
		expect(screen.queryByTestId("mobile-topic-share-copy-link-button")).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("mobile-topic-share-toggle-row"))

		await waitFor(() => {
			expect(SuperMagicApi.cancelShareResource).not.toHaveBeenCalled()
			expect(SuperMagicApi.createOrUpdateShareResource).not.toHaveBeenCalled()
		})
	})

	it("管理员只开放公开访问时以公开方式创建分享", async () => {
		functionPermissionMocks.permissions = {
			"project.share_password": false,
			"project.share_public": true,
		}
		vi.mocked(SuperMagicApi.createOrUpdateShareResource).mockResolvedValue({})

		render(
			<MobileTopicShare
				type={ShareType.None}
				shareContext={{ resource_id: "topic-1" }}
				extraData={{ passwordEnabled: true, password: "abc123" }}
				setExtraData={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-topic-share-toggle-row"))

		await waitFor(() => {
			expect(SuperMagicApi.createOrUpdateShareResource).toHaveBeenCalledTimes(1)
		})
		expect(vi.mocked(SuperMagicApi.createOrUpdateShareResource).mock.calls[0][0]).toMatchObject(
			{
				share_type: ShareType.Public,
			},
		)
	})

	it("权限请求未就绪前不创建分享，避免写入被管控的方式", async () => {
		functionPermissionMocks.permissions = {
			"project.share_password": false,
			"project.share_public": true,
		}
		functionPermissionMocks.isLoading = true

		render(
			<MobileTopicShare
				type={ShareType.None}
				shareContext={{ resource_id: "topic-1" }}
				extraData={{ passwordEnabled: true, password: "abc123" }}
				setExtraData={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-topic-share-toggle-row"))

		await waitFor(() => {
			expect(SuperMagicApi.createOrUpdateShareResource).not.toHaveBeenCalled()
		})
	})

	it("话题权限组关闭密码保护时以公开方式创建分享", async () => {
		functionPermissionMocks.permissions = {
			"project.share_password": true,
			"project.share_public": true,
			"topic.share_password": false,
			"topic.share_public": true,
		}
		vi.mocked(SuperMagicApi.createOrUpdateShareResource).mockResolvedValue({})

		render(
			<MobileTopicShare
				type={ShareType.None}
				shareContext={{ resource_id: "topic-1" }}
				extraData={{ passwordEnabled: true, password: "abc123" }}
				setExtraData={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-topic-share-toggle-row"))

		await waitFor(() => {
			expect(SuperMagicApi.createOrUpdateShareResource).toHaveBeenCalledTimes(1)
		})
		expect(vi.mocked(SuperMagicApi.createOrUpdateShareResource).mock.calls[0][0]).toMatchObject(
			{
				share_type: ShareType.Public,
			},
		)
	})

	it("首次开启话题分享时上报 content_share_attempted", async () => {
		vi.mocked(SuperMagicApi.createOrUpdateShareResource).mockResolvedValue({} as never)

		render(
			<MobileTopicShare
				type={ShareType.None}
				shareContext={{ resource_id: "topic-new" }}
				extraData={{ passwordEnabled: true, password: "abc123" }}
				setExtraData={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-topic-share-toggle-row"))

		await waitFor(() => {
			expect(trackMock).toHaveBeenCalledTimes(1)
		})
		expect(trackMock).toHaveBeenCalledWith("content_share_attempted", {
			resourceType: ResourceType.Topic,
		})
	})

	it("更新密码保护时不上报 content_share_attempted", async () => {
		vi.mocked(SuperMagicApi.createOrUpdateShareResource).mockResolvedValue({} as never)

		render(
			<MobileTopicShare
				type={ShareType.Public}
				shareContext={{ resource_id: "topic-1" }}
				extraData={{ passwordEnabled: false, password: "abc123" }}
				setExtraData={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-topic-share-password-toggle-row"))

		await waitFor(() => {
			expect(SuperMagicApi.createOrUpdateShareResource).toHaveBeenCalled()
		})
		expect(trackMock).not.toHaveBeenCalled()
	})

	it("开启话题分享失败时仍上报 content_share_attempted", async () => {
		vi.mocked(SuperMagicApi.createOrUpdateShareResource).mockRejectedValue(new Error("fail"))

		render(
			<MobileTopicShare
				type={ShareType.None}
				shareContext={{ resource_id: "topic-fail" }}
				extraData={{ passwordEnabled: true, password: "abc123" }}
				setExtraData={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-topic-share-toggle-row"))

		await waitFor(() => {
			expect(magicToast.error).toHaveBeenCalledWith("share.createFailed")
		})
		expect(trackMock).toHaveBeenCalledWith("content_share_attempted", {
			resourceType: ResourceType.Topic,
		})
	})

	it("关闭后重新开启分享会再次上报 content_share_attempted", async () => {
		vi.mocked(SuperMagicApi.createOrUpdateShareResource).mockResolvedValue({} as never)
		vi.mocked(SuperMagicApi.cancelShareResource).mockResolvedValue(undefined as never)

		render(
			<MobileTopicShare
				type={ShareType.None}
				shareContext={{ resource_id: "topic-once" }}
				extraData={{ passwordEnabled: true, password: "abc123" }}
				setExtraData={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mobile-topic-share-toggle-row"))
		await waitFor(() => {
			expect(trackMock).toHaveBeenCalledTimes(1)
		})

		fireEvent.click(screen.getByTestId("mobile-topic-share-toggle-row"))
		await waitFor(() => {
			expect(SuperMagicApi.cancelShareResource).toHaveBeenCalledTimes(1)
		})

		fireEvent.click(screen.getByTestId("mobile-topic-share-toggle-row"))
		await waitFor(() => {
			expect(SuperMagicApi.createOrUpdateShareResource).toHaveBeenCalledTimes(2)
			expect(trackMock).toHaveBeenCalledTimes(2)
		})
	})
})
