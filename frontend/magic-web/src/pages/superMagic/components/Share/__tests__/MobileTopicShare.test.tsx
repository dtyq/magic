import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import { clipboard } from "@/utils/clipboard-helpers"
import MobileTopicShare from "../MobileTopicShare"
import { ShareType } from "../types"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/utils/clipboard-helpers", () => ({
	clipboard: {
		writeText: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createOrUpdateShareResource: vi.fn(),
		cancelShareResource: vi.fn(),
	},
}))

describe("MobileTopicShare", () => {
	beforeEach(() => {
		vi.clearAllMocks()
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

	it("点击复制链接按钮会复制当前 shareUrl", () => {
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

		fireEvent.click(screen.getByTestId("mobile-topic-share-copy-link-button"))
		expect(clipboard.writeText).toHaveBeenCalledWith("https://example.com/topic-1")
	})

	it("开启密码保护时点击复制链接按钮会复制带密码参数的完整链接", () => {
		render(
			<MobileTopicShare
				type={ShareType.PasswordProtected}
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
		expect(clipboard.writeText).toHaveBeenCalledWith(
			"https://example.com/topic-1?password=abc123",
		)
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
})
