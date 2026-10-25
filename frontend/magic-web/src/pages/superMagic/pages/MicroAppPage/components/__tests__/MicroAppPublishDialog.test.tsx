import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { userStore } from "@/models/user"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import {
	createPasswordProtectedDetail,
	getPublishDialogMocks,
	renderDialog,
	resetPublishDialogMocks,
	setOrganizationSubscription,
} from "./MicroAppPublishDialog.testUtils"

const mocks = getPublishDialogMocks()

describe("MicroAppPublishDialog", () => {
	beforeEach(() => {
		resetPublishDialogMocks()
	})

	it("loads publish state through the app detail endpoint", async () => {
		mocks.getMicroAppProject.mockResolvedValue({
			app_id: "app-1",
			project_id: "project-1",
			project: { id: "project-1", project_name: "Demo App" },
			publish: {
				app_id: "app-1",
				app_name: "Demo App",
				resource_id: "resource-1",
				share_type: ShareType.Public,
				publish_status: "published",
				access_url: "https://example.com/micro-app/app-1",
			},
		})

		renderDialog()

		await waitFor(() => {
			expect(mocks.getMicroAppProject).toHaveBeenCalledWith("app-1")
			expect(screen.getByTestId("micro-app-publish-access-url")).toHaveValue(
				"https://example.com/micro-app/app-1",
			)
		})

		const publishedSection = screen.getByTestId("micro-app-published-section")
		const basicSettings = screen.getByTestId("micro-app-publish-basic-settings")
		expect(publishedSection).toHaveClass("border-emerald-200", "bg-emerald-50/60")
		expect(publishedSection).not.toHaveClass("col-span-2")
		expect(publishedSection.parentElement).toHaveClass("grid-cols-1")
		expect(publishedSection.nextElementSibling).toBe(basicSettings)
	})

	it("loads the published password before copying password-protected share text", async () => {
		mocks.getMicroAppProject.mockResolvedValue(createPasswordProtectedDetail())
		mocks.getShareInfoByCode.mockResolvedValue({
			password: "open1234",
		})

		renderDialog()

		fireEvent.click(await screen.findByTestId("micro-app-publish-copy-share-text"))

		await waitFor(() => {
			expect(mocks.getShareInfoByCode).toHaveBeenCalledWith({ code: "share-code-1" })
			expect(mocks.writeText).toHaveBeenCalledWith(
				"microAppPage.publish.shareTextTitle:Demo App\n\nmicroAppPage.publish.shareTextAccessHint\nhttps://example.com/micro-app/app-1\n\nmicroAppPage.publish.shareTextPassword:open1234",
			)
		})
	})

	it("copies the published password in the standalone link query string", async () => {
		mocks.getMicroAppProject.mockResolvedValue(createPasswordProtectedDetail())
		mocks.getShareInfoByCode.mockResolvedValue({ password: "open 1234" })

		renderDialog()

		fireEvent.click(await screen.findByTestId("micro-app-publish-copy-link"))

		await waitFor(() => {
			expect(mocks.writeText).toHaveBeenCalledWith(
				"https://example.com/micro-app/app-1?password=open+1234",
			)
		})
	})

	it("does not copy incomplete share text when the published password is unavailable", async () => {
		mocks.getMicroAppProject.mockResolvedValue(createPasswordProtectedDetail())

		renderDialog()

		fireEvent.click(await screen.findByTestId("micro-app-publish-copy-share-text"))

		expect(mocks.writeText).not.toHaveBeenCalled()
		expect(mocks.errorToast).toHaveBeenCalledWith(
			"microAppPage.publish.shareTextPasswordUnavailable",
		)
	})

	it("disables quick sharing until changed publish settings are saved", async () => {
		mocks.getMicroAppProject.mockResolvedValue(createPasswordProtectedDetail())
		mocks.getShareInfoByCode.mockResolvedValue({ password: "open1234" })
		mocks.publishMicroAppProject.mockResolvedValue({
			...createPasswordProtectedDetail().publish,
			password: undefined,
		})

		renderDialog()

		const copyLinkButton = await screen.findByTestId("micro-app-publish-copy-link")
		const copyShareTextButton = screen.getByTestId("micro-app-publish-copy-share-text")
		expect(copyLinkButton).toBeEnabled()
		expect(copyShareTextButton).toBeEnabled()

		fireEvent.change(screen.getByTestId("micro-app-publish-password"), {
			target: { value: "next1234" },
		})

		expect(screen.getByTestId("micro-app-publish-settings-changed")).toHaveTextContent(
			"microAppPage.publish.settingsChanged",
		)
		expect(copyLinkButton).toBeDisabled()
		expect(copyShareTextButton).toBeDisabled()

		fireEvent.click(screen.getByTestId("micro-app-publish-save"))

		await waitFor(() => {
			expect(screen.queryByTestId("micro-app-publish-settings-changed")).toBeNull()
			expect(copyLinkButton).toBeEnabled()
			expect(copyShareTextButton).toBeEnabled()
		})
	})

	it("limits the content height and scrolls overflowing settings", async () => {
		renderDialog()

		const basicScrollArea = await screen.findByTestId("micro-app-publish-scroll-area")
		const shareScrollArea = screen.getByTestId("micro-app-publish-share-panel")
		expect(basicScrollArea).toHaveAttribute("data-slot", "scroll-area")
		expect(shareScrollArea).toHaveAttribute("data-slot", "scroll-area")
		expect(basicScrollArea).toHaveClass("h-full", "min-h-0", "min-w-0")
		expect(shareScrollArea).toHaveClass("h-full", "min-h-0", "min-w-0")
		expect(basicScrollArea.querySelector("[data-slot='scroll-area-viewport']")).not.toBeNull()
		expect(shareScrollArea.querySelector("[data-slot='scroll-area-viewport']")).not.toBeNull()
		expect(screen.getByTestId("micro-app-publish-basic-settings").parentElement).toHaveClass(
			"p-5",
		)
		expect(screen.getByTestId("micro-app-publish-dialog")).toHaveClass(
			"grid",
			"max-h-[80dvh]",
			"grid-rows-[minmax(0,1fr)_auto_auto]",
		)
	})

	it("disables saving when published settings have not changed", async () => {
		mocks.getMicroAppProject.mockResolvedValue({
			app_id: "app-1",
			project_id: "project-1",
			project: { id: "project-1", project_name: "Demo App" },
			publish: {
				app_id: "app-1",
				app_name: "Demo App",
				share_type: ShareType.Public,
				publish_status: "published",
			},
		})

		renderDialog()

		const saveButton = await screen.findByTestId("micro-app-publish-save")
		expect(saveButton).toBeDisabled()

		fireEvent.change(screen.getByTestId("micro-app-publish-project-name"), {
			target: { value: "Updated App" },
		})
		expect(saveButton).toBeEnabled()
	})

	it("uses a fixed-height mobile bottom popup with a scrollable form area", async () => {
		renderDialog({ mobile: true })

		const popup = screen.getByTestId("mobile-publish-popup")
		expect(popup).toHaveAttribute("data-position", "bottom")
		expect(popup).toHaveClass("h-[88dvh]", "max-h-[88dvh]")
		expect(screen.getByTestId("micro-app-publish-dialog")).toHaveAttribute(
			"data-mobile",
			"true",
		)

		const scrollArea = await screen.findByTestId("micro-app-publish-scroll-area")
		expect(scrollArea).toHaveClass("min-h-0", "flex-1")
		expect(scrollArea.parentElement).toHaveClass("flex", "flex-1", "flex-col")
		expect(scrollArea.querySelector("[data-slot='scroll-area-viewport']")).toHaveClass(
			"touch-pan-y",
		)
		const popupActions = screen.getByTestId("micro-app-publish-actions")
		expect(popupActions).toHaveClass("shrink-0", "flex-col")
		expect(popupActions.closest("[data-slot='scroll-area-viewport']")).toBeNull()
		expect(popup).toHaveAttribute("data-header-variant", "actionHeader")
		expect(popup).toHaveAttribute(
			"data-body-class-name",
			"flex min-h-0 flex-1 flex-col overflow-hidden p-0",
		)
		expect(screen.getByTestId("micro-app-publish-close")).toBeInTheDocument()
	})

	it("groups the app name and cover in one settings section", async () => {
		renderDialog()

		const settings = await screen.findByTestId("micro-app-publish-basic-settings")
		expect(settings).toContainElement(screen.getByTestId("micro-app-publish-project-name"))
		expect(settings).toContainElement(screen.getByTestId("micro-app-cover-upload"))
	})

	it("uses a searchable combobox for the default entry", async () => {
		renderDialog({
			attachmentList: [
				{
					file_id: "entry-1",
					file_name: "index.html",
					relative_file_path: "index.html",
				},
			],
		})

		const trigger = await screen.findByTestId("micro-app-default-open-file")
		expect(trigger).toHaveAttribute("data-slot", "popover-trigger")
		expect(trigger).toHaveAttribute("role", "combobox")
		expect(trigger).toHaveTextContent("microAppPage.publish.defaultOpenFileAuto")
	})

	it("disables publishing and prompts for a missing app name", async () => {
		mocks.getMicroAppProject.mockResolvedValue({
			app_id: "app-1",
			project_id: "project-1",
			project: { id: "project-1", project_name: "" },
			publish: null,
		})

		renderDialog({ projectName: "" })

		const saveButton = await screen.findByTestId("micro-app-publish-save")
		await waitFor(() => {
			expect(saveButton).toBeDisabled()
			expect(screen.getByTestId("micro-app-publish-validation-message")).toHaveTextContent(
				"microAppPage.publish.projectNameRequired",
			)
		})

		fireEvent.change(screen.getByTestId("micro-app-publish-project-name"), {
			target: { value: "库存管理助手" },
		})

		expect(saveButton).toBeEnabled()
		expect(screen.queryByTestId("micro-app-publish-validation-message")).toBeNull()
	})

	it("resolves and renders an existing cover from its file key", async () => {
		mocks.getMicroAppProject.mockResolvedValue({
			app_id: "app-1",
			project_id: "project-1",
			project: { id: "project-1", project_name: "Demo App" },
			publish: {
				app_id: "app-1",
				app_name: "Demo App",
				cover_file_key: "micro-app/covers/existing.png",
				share_type: ShareType.Public,
				publish_status: "published",
			},
		})

		renderDialog()

		await waitFor(() => {
			expect(mocks.getFileUrl).toHaveBeenCalledWith("micro-app/covers/existing.png")
			expect(screen.getByTestId("micro-app-cover-preview")).toHaveAttribute(
				"src",
				"https://cdn.example.com/existing-cover.png",
			)
		})
	})

	it("publishes with app_name instead of project_name", async () => {
		const onPublishStatusChange = vi.fn()
		renderDialog({ onPublishStatusChange })
		await screen.findByTestId("share-type-field")

		fireEvent.click(screen.getByTestId("share-type-public"))
		fireEvent.change(screen.getByTestId("micro-app-publish-project-name"), {
			target: { value: "库存管理助手" },
		})
		fireEvent.click(screen.getByTestId("micro-app-publish-save"))

		await waitFor(() => {
			expect(mocks.publishMicroAppProject).toHaveBeenCalledWith("app-1", {
				app_name: "库存管理助手",
				share_type: ShareType.Public,
				extra: { pure_mode: false },
			})
			expect(onPublishStatusChange).toHaveBeenCalledWith(true)
		})
	})

	it("defaults personal organizations to public access and hides the share range", async () => {
		userStore.user.setIsPersonalOrganization(true)

		renderDialog()

		const shareTypeField = await screen.findByTestId("share-type-field")
		expect(shareTypeField).toHaveAttribute("data-value", String(ShareType.Public))
		expect(screen.queryByTestId("share-type-organization")).toBeNull()
		expect(screen.queryByTestId("share-range-field")).toBeNull()

		fireEvent.click(screen.getByTestId("force-share-type-organization"))
		expect(shareTypeField).toHaveAttribute("data-value", String(ShareType.Public))

		fireEvent.click(screen.getByTestId("micro-app-publish-save"))

		await waitFor(() => {
			expect(mocks.publishMicroAppProject).toHaveBeenCalledWith("app-1", {
				app_name: "Demo App",
				share_type: ShareType.Public,
				extra: { pure_mode: false },
			})
		})
	})

	it("requires personal organizations to save historical organization sharing as public", async () => {
		userStore.user.setIsPersonalOrganization(true)
		mocks.getMicroAppProject.mockResolvedValue({
			app_id: "app-1",
			project_id: "project-1",
			project: { id: "project-1", project_name: "Demo App" },
			publish: {
				app_id: "app-1",
				app_name: "Demo App",
				resource_id: "resource-1",
				share_type: ShareType.Organization,
				share_range: "all",
				publish_status: "published",
				access_url: "https://example.com/micro-app/app-1",
			},
		})

		renderDialog()

		const shareTypeField = await screen.findByTestId("share-type-field")
		expect(shareTypeField).toHaveAttribute("data-value", String(ShareType.Public))
		expect(screen.getByTestId("micro-app-publish-settings-changed")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("micro-app-publish-save"))

		await waitFor(() => {
			expect(mocks.publishMicroAppProject).toHaveBeenCalledWith("app-1", {
				app_name: "Demo App",
				share_type: ShareType.Public,
				extra: { pure_mode: false },
			})
		})
	})

	it("generates an initial password for an unpublished protected share", async () => {
		mocks.getMicroAppProject.mockResolvedValue({
			app_id: "app-1",
			project_id: "project-1",
			project: { id: "project-1", project_name: "Demo App" },
			publish: {
				app_id: "app-1",
				app_name: "Demo App",
				share_type: ShareType.PasswordProtected,
				publish_status: "unpublished",
			},
		})

		renderDialog()

		const passwordInput = await screen.findByTestId("micro-app-publish-password")
		expect((passwordInput as HTMLInputElement).value).toMatch(/^[A-Z0-9]{6}$/)
		expect(screen.getByTestId("micro-app-publish-save")).toBeEnabled()
	})

	it("clears an existing cover by sending null", async () => {
		mocks.getMicroAppProject.mockResolvedValue({
			app_id: "app-1",
			project_id: "project-1",
			project: { id: "project-1", project_name: "Demo App" },
			publish: {
				app_id: "app-1",
				app_name: "Demo App",
				cover_file_key: "micro-app/covers/old.png",
				share_type: ShareType.Public,
				publish_status: "published",
			},
		})

		renderDialog()
		await screen.findByTestId("micro-app-cover-clear")
		fireEvent.click(screen.getByTestId("micro-app-cover-clear"))
		fireEvent.click(screen.getByTestId("micro-app-publish-save"))

		await waitFor(() => {
			expect(mocks.publishMicroAppProject).toHaveBeenCalledWith("app-1", {
				app_name: "Demo App",
				share_type: ShareType.Public,
				cover_file_key: null,
				extra: { pure_mode: false },
			})
		})
	})

	it("reports unpublished state after unpublishing succeeds", async () => {
		const onPublishStatusChange = vi.fn()
		mocks.getMicroAppProject.mockResolvedValue({
			app_id: "app-1",
			project_id: "project-1",
			project: { id: "project-1", project_name: "Demo App" },
			publish: {
				app_id: "app-1",
				app_name: "Demo App",
				resource_id: "resource-1",
				share_type: ShareType.Public,
				publish_status: "published",
			},
		})

		renderDialog({ onPublishStatusChange })
		fireEvent.click(await screen.findByTestId("micro-app-unpublish-button"))

		await waitFor(() => {
			expect(mocks.unpublishMicroAppProject).toHaveBeenCalledWith("app-1")
			expect(onPublishStatusChange).toHaveBeenCalledWith(false)
		})
	})

	it("uploads an image cover and publishes its file key", async () => {
		renderDialog()
		await screen.findByTestId("share-type-field")

		const file = new File(["cover"], "cover.png", { type: "image/png" })
		fireEvent.change(screen.getByTestId("micro-app-cover-input"), {
			target: { files: [file] },
		})
		await waitFor(() => expect(mocks.uploadAndGetFileUrl).toHaveBeenCalledOnce())
		expect(mocks.useUploadOptions).toEqual({ storageType: "public", useSnowflakeId: true })

		fireEvent.click(screen.getByTestId("micro-app-publish-save"))
		await waitFor(() => {
			expect(mocks.publishMicroAppProject).toHaveBeenCalledWith("app-1", {
				app_name: "Demo App",
				share_type: ShareType.Organization,
				share_range: "all",
				cover_file_key: "micro-app/covers/new.png",
				extra: { pure_mode: false },
			})
		})
	})

	it("uploads a pasted image cover", async () => {
		renderDialog()
		await screen.findByTestId("share-type-field")

		const file = new File(["pasted cover"], "pasted-cover.png", { type: "image/png" })
		fireEvent.paste(screen.getByTestId("micro-app-publish-dialog"), {
			clipboardData: { files: [file], items: [] },
		})

		await waitFor(() => {
			expect(mocks.uploadAndGetFileUrl).toHaveBeenCalledWith([
				{ name: "pasted-cover.png", file, status: "init" },
			])
			expect(screen.getByTestId("micro-app-cover-preview")).toHaveAttribute(
				"src",
				"https://cdn.example.com/cover.png",
			)
		})
	})

	it("reports cover upload failures and keeps publishing disabled", async () => {
		mocks.uploadAndGetFileUrl.mockRejectedValueOnce(new Error("upload failed"))

		renderDialog()
		await screen.findByTestId("share-type-field")

		const file = new File(["cover"], "cover.png", { type: "image/png" })
		fireEvent.change(screen.getByTestId("micro-app-cover-input"), {
			target: { files: [file] },
		})

		await waitFor(() => {
			expect(mocks.errorToast).toHaveBeenCalledWith("microAppPage.publish.coverUploadFailed")
		})
		expect(screen.getByTestId("micro-app-publish-save")).toBeDisabled()

		fireEvent.click(screen.getByTestId("micro-app-publish-save"))
		expect(mocks.publishMicroAppProject).not.toHaveBeenCalled()
	})

	it("keeps normal text paste behavior in publish fields", async () => {
		renderDialog()
		await screen.findByTestId("share-type-field")

		const file = new File(["clipboard image"], "clipboard.png", { type: "image/png" })
		const pasteEvent = new Event("paste", { bubbles: true, cancelable: true })
		Object.defineProperty(pasteEvent, "clipboardData", {
			value: { files: [file], items: [] },
		})
		screen.getByTestId("micro-app-publish-project-name").dispatchEvent(pasteEvent)

		expect(pasteEvent.defaultPrevented).toBe(false)
		expect(mocks.uploadAndGetFileUrl).not.toHaveBeenCalled()
	})

	it("只展示管理员允许的微应用分享方式，并自动选中首个可用项", async () => {
		mocks.functionPermissions = {
			"micro_app.share_password": false,
			"micro_app.share_public": true,
			"micro_app.share_team": false,
		}

		renderDialog()

		await waitFor(() => {
			expect(screen.getByTestId("share-type-field")).toHaveAttribute(
				"data-value",
				String(ShareType.Public),
			)
		})
		expect(screen.getByTestId("share-type-public")).toBeInTheDocument()
		expect(screen.queryByTestId("share-type-organization")).not.toBeInTheDocument()
	})

	it("管理员未开放任何微应用分享方式时禁用发布", async () => {
		mocks.functionPermissions = {
			"micro_app.share_password": false,
			"micro_app.share_public": false,
			"micro_app.share_team": false,
		}

		renderDialog()

		expect(await screen.findByText("share.noAvailableShareMethods")).toBeInTheDocument()
		expect(screen.getByTestId("micro-app-publish-save")).toBeDisabled()
		// 只有「分享方式」与提示保留，分享设置里的其它项不再渲染。
		expect(screen.getByTestId("share-type-field")).toBeInTheDocument()
		expect(screen.queryByTestId("share-expiry-field")).not.toBeInTheDocument()
	})

	it("管理员未开放任何分享方式时已发布的密码项也一并收起", async () => {
		mocks.functionPermissions = {
			"micro_app.share_password": false,
			"micro_app.share_public": false,
			"micro_app.share_team": false,
		}
		mocks.getMicroAppProject.mockResolvedValue(createPasswordProtectedDetail())

		renderDialog()

		expect(await screen.findByText("share.noAvailableShareMethods")).toBeInTheDocument()
		// 已发布的方式本身仍展示，但它对应的设置项不再展示。
		expect(screen.getByTestId("share-type-field")).toBeInTheDocument()
		expect(screen.queryByTestId("micro-app-publish-password")).not.toBeInTheDocument()
		expect(screen.queryByTestId("share-expiry-field")).not.toBeInTheDocument()
		// 左侧发布表单不受分享管控影响。
		expect(screen.getByTestId("micro-app-publish-project-name")).toBeInTheDocument()
		expect(screen.getByTestId("micro-app-cover-upload")).toBeInTheDocument()
	})

	it("移动端管理员未开放任何分享方式时同样收起分享设置里的其它项", async () => {
		mocks.functionPermissions = {
			"micro_app.share_password": false,
			"micro_app.share_public": false,
			"micro_app.share_team": false,
		}
		mocks.getMicroAppProject.mockResolvedValue(createPasswordProtectedDetail())

		renderDialog({ mobile: true })

		expect(await screen.findByText("share.noAvailableShareMethods")).toBeInTheDocument()
		expect(screen.getByTestId("share-type-field")).toBeInTheDocument()
		expect(screen.queryByTestId("micro-app-publish-password")).not.toBeInTheDocument()
		expect(screen.queryByTestId("share-expiry-field")).not.toBeInTheDocument()
		expect(screen.getByTestId("micro-app-publish-project-name")).toBeInTheDocument()
	})

	// P0-3: `ShareTypeField` hides team sharing for a free plan, so defaulting to it left the dialog
	// with nothing selected while the publish payload still carried Organization.
	it("免费计划默认落回公开访问，而不是被隐藏的团队分享", async () => {
		setOrganizationSubscription(false)

		renderDialog()

		await waitFor(() => {
			expect(screen.getByTestId("share-type-field")).toHaveAttribute(
				"data-value",
				String(ShareType.Public),
			)
		})
	})

	it("免费计划下发布微应用时提交公开访问", async () => {
		setOrganizationSubscription(false)

		renderDialog()

		fireEvent.click(await screen.findByTestId("micro-app-publish-save"))

		await waitFor(() => {
			expect(mocks.publishMicroAppProject).toHaveBeenCalledWith(
				"app-1",
				expect.objectContaining({ share_type: ShareType.Public }),
			)
		})
	})

	// Backstop: even if a caller sets the state directly, the plan gate must never reach the request.
	it("免费计划下直接改状态也选不中团队分享", async () => {
		setOrganizationSubscription(false)

		renderDialog()
		await screen.findByTestId("share-type-field")

		fireEvent.click(screen.getByTestId("force-share-type-organization"))

		expect(screen.getByTestId("share-type-field")).toHaveAttribute(
			"data-value",
			String(ShareType.Public),
		)
	})

	// A live share keeps its own method: opening the dialog must not rewrite it just because the
	// organization is on a free plan.
	it("免费计划下已发布的团队分享保持不变", async () => {
		setOrganizationSubscription(false)
		mocks.getMicroAppProject.mockResolvedValue({
			app_id: "app-1",
			project_id: "project-1",
			project: { id: "project-1", project_name: "Demo App" },
			publish: {
				app_id: "app-1",
				app_name: "Demo App",
				resource_id: "resource-1",
				share_code: "share-code-1",
				share_type: ShareType.Organization,
				publish_status: "published",
				access_url: "https://example.com/micro-app/app-1",
			},
		})

		renderDialog()

		await waitFor(() => {
			expect(screen.getByTestId("share-type-field")).toHaveAttribute(
				"data-value",
				String(ShareType.Organization),
			)
		})
	})
})
