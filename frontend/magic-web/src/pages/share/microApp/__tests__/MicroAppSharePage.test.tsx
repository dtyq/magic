import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { RoutePath } from "@/constants/routes"
import { whiteListRoutes } from "@/routes/const/whiteRoutes"
import {
	getMicroAppSharePageMocks,
	renderPage,
	resetMicroAppSharePageMocks,
} from "./MicroAppSharePage.testUtils"

const mocks = getMicroAppSharePageMocks()

async function confirmSafetyNotice() {
	expect(await screen.findByTestId("micro-app-share-safety-notice")).toBeInTheDocument()
	expect(screen.queryByTestId("mock-html-preview")).not.toBeInTheDocument()
	fireEvent.click(screen.getByTestId("micro-app-share-safety-confirm"))
	return screen.findByTestId("mock-html-preview")
}

describe("MicroAppSharePage", () => {
	beforeEach(resetMicroAppSharePageMocks)

	it("registers the standalone micro app route as public", () => {
		expect(RoutePath.MicroAppShare).toBe("/micro-app/:appId")
		expect(whiteListRoutes).toContain("/micro-app/*")
	})

	it("keeps manifest links synchronized when navigating between shared apps", async () => {
		renderPage()
		await waitFor(() => {
			expect(
				document.head
					.querySelector<HTMLLinkElement>('link[data-micro-app-install="manifest"]')
					?.getAttribute("href"),
			).toBe("/micro-app/app-1/manifest.webmanifest")
		})

		fireEvent.click(screen.getByTestId("navigate-to-second-micro-app"))
		await waitFor(() => {
			expect(
				document.head
					.querySelector<HTMLLinkElement>('link[data-micro-app-install="manifest"]')
					?.getAttribute("href"),
			).toBe("/micro-app/app-2/manifest.webmanifest")
		})
	})

	it("waits for safety confirmation before rendering the root html entry", async () => {
		renderPage()

		await waitFor(() => {
			expect(mocks.resolvePublishedMicroApp).toHaveBeenCalledWith("app-1")
			expect(mocks.getShareResource).toHaveBeenCalledWith({
				resource_id: "resource-1",
				password: undefined,
			})
			expect(mocks.loadShareFilesV2).toHaveBeenCalledWith({
				resourceId: "resource-1",
				password: undefined,
			})
		})

		expect(await screen.findByTestId("micro-app-share-safety-notice")).toHaveTextContent(
			"Demo App",
		)
		expect(screen.getByTestId("micro-app-share-cover")).toHaveAttribute(
			"src",
			"https://example.com/cover.webp",
		)
		expect(screen.getByText("microAppShare.safetySensitiveData")).toBeInTheDocument()
		expect(screen.queryByTestId("mock-html-preview")).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("micro-app-share-safety-confirm"))

		expect(await screen.findByTestId("mock-html-preview")).toHaveTextContent("index.html")
		expect(screen.getByTestId("mock-html-preview")).toHaveAttribute(
			"data-project-id",
			"project-1",
		)
		expect(screen.getByTestId("mock-html-preview")).toHaveAttribute(
			"data-is-share-preview",
			"true",
		)
		expect(screen.queryByTestId("micro-app-share-safety-notice")).not.toBeInTheDocument()
	})

	it("remembers the safety confirmation for the current micro app when selected", async () => {
		const firstRender = renderPage()

		const doNotRemind = await screen.findByRole("checkbox", {
			name: "microAppShare.safetyDoNotRemind",
		})
		expect(doNotRemind).not.toBeChecked()

		fireEvent.click(doNotRemind)
		fireEvent.click(screen.getByTestId("micro-app-share-safety-confirm"))
		expect(await screen.findByTestId("mock-html-preview")).toBeInTheDocument()

		firstRender.unmount()
		renderPage()

		expect(await screen.findByTestId("mock-html-preview")).toBeInTheDocument()
		expect(screen.queryByTestId("micro-app-share-safety-notice")).not.toBeInTheDocument()
	})

	it("shows the safety reminder again when the checkbox is not selected", async () => {
		const firstRender = renderPage()

		await confirmSafetyNotice()
		firstRender.unmount()
		renderPage()

		expect(await screen.findByTestId("micro-app-share-safety-notice")).toBeInTheDocument()
		expect(screen.queryByTestId("mock-html-preview")).not.toBeInTheDocument()
	})

	it("keeps the safety reminder scoped to the confirmed micro app", async () => {
		renderPage()

		fireEvent.click(
			await screen.findByRole("checkbox", {
				name: "microAppShare.safetyDoNotRemind",
			}),
		)
		fireEvent.click(screen.getByTestId("micro-app-share-safety-confirm"))
		await screen.findByTestId("mock-html-preview")

		fireEvent.click(screen.getByTestId("navigate-to-second-micro-app"))

		expect(await screen.findByTestId("micro-app-share-safety-notice")).toBeInTheDocument()
		expect(screen.queryByTestId("mock-html-preview")).not.toBeInTheDocument()
	})

	it("still confirms the current visit when browser storage is unavailable", async () => {
		const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("storage unavailable")
		})

		try {
			renderPage()
			fireEvent.click(
				await screen.findByRole("checkbox", {
					name: "microAppShare.safetyDoNotRemind",
				}),
			)
			fireEvent.click(screen.getByTestId("micro-app-share-safety-confirm"))

			expect(await screen.findByTestId("mock-html-preview")).toBeInTheDocument()
		} finally {
			setItem.mockRestore()
		}
	})

	it("shows permission management beside the user only after access confirmation", async () => {
		mocks.authorization.current = "token-1"
		mocks.hasHtmlPermissionDeclarations.current = true
		mocks.userInfo.current = {
			user_id: "usi_1",
			magic_id: "magic_1",
			nickname: "测试用户",
			real_name: "测试用户",
			avatar: "",
			status: 1,
			organization_code: "magic-org-1",
		}

		renderPage()

		expect(await screen.findByTestId("micro-app-share-safety-notice")).toBeInTheDocument()
		expect(screen.queryByTestId("micro-app-share-permission-manager")).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("micro-app-share-safety-confirm"))

		const permissionManagerButton = await screen.findByTestId(
			"micro-app-share-permission-manager",
		)
		expect(permissionManagerButton).toHaveTextContent("htmlEditor.permissionManager.open")
		expect(permissionManagerButton.nextElementSibling).toBe(
			screen.getByTestId("micro-app-share-user"),
		)

		fireEvent.click(permissionManagerButton)

		expect(mocks.openHtmlPermissionManager).toHaveBeenCalledTimes(1)
	})

	it("does not show permission management when app.json has no permission declarations", async () => {
		mocks.authorization.current = "token-1"
		mocks.userInfo.current = {
			user_id: "usi_1",
			magic_id: "magic_1",
			nickname: "测试用户",
			real_name: "测试用户",
			avatar: "",
			status: 1,
			organization_code: "magic-org-1",
		}

		renderPage()

		await confirmSafetyNotice()

		expect(screen.queryByTestId("micro-app-share-permission-manager")).not.toBeInTheDocument()
	})

	it("does not show permission management for anonymous visitors", async () => {
		mocks.hasHtmlPermissionDeclarations.current = true

		renderPage()

		await confirmSafetyNotice()

		expect(screen.getByTestId("micro-app-share-login")).toBeInTheDocument()
		expect(screen.queryByTestId("micro-app-share-permission-manager")).not.toBeInTheDocument()
	})

	it("hides a cover image that fails to load", async () => {
		renderPage()

		const cover = await screen.findByTestId("micro-app-share-cover")
		fireEvent.error(cover)

		expect(screen.queryByTestId("micro-app-share-cover")).not.toBeInTheDocument()
	})

	it("does not render an empty cover placeholder when no cover is published", async () => {
		mocks.resolvePublishedMicroApp.mockResolvedValue({
			app_id: "app-1",
			resource_id: "resource-1",
			share_code: "resource-1",
		})

		renderPage()

		expect(await screen.findByTestId("micro-app-share-safety-notice")).toBeInTheDocument()
		expect(screen.queryByTestId("micro-app-share-cover")).not.toBeInTheDocument()
	})

	it("loads app.json with explicit share access and does not set window identity", async () => {
		mocks.getTemporaryDownloadUrl.mockImplementation(async () => {
			expect(window.temporary_token).toBeUndefined()
			expect(window.project_id).toBeUndefined()
			return [{ url: "https://example.com/app.json" }]
		})

		renderPage()

		expect(await screen.findByTestId("micro-app-share-safety-notice")).toBeInTheDocument()
		expect(mocks.getTemporaryDownloadUrl).toHaveBeenCalledWith(
			expect.objectContaining({
				file_ids: ["app-json-1"],
				access: expect.objectContaining({
					kind: "share",
					token: "token-1",
					projectId: "project-1",
				}),
			}),
		)
		expect(window.temporary_token).toBeUndefined()
		expect(window.project_id).toBeUndefined()
	})

	it("replaces the current preview across repeated html navigation", async () => {
		mocks.loadShareFilesV2.mockResolvedValue({
			tree: [
				{
					file_id: "app-json-1",
					file_name: "app.json",
					file_extension: "json",
					relative_file_path: "app.json",
				},
				{
					file_id: "file-1",
					file_name: "index.html",
					file_extension: "html",
					relative_file_path: "index.html",
				},
				{
					file_id: "file-2",
					file_name: "admin.html",
					file_extension: "html",
					relative_file_path: "admin.html",
				},
			],
			list: [
				{
					file_id: "app-json-1",
					file_name: "app.json",
					file_extension: "json",
					relative_file_path: "app.json",
				},
				{
					file_id: "file-1",
					file_name: "index.html",
					file_extension: "html",
					relative_file_path: "index.html",
				},
				{
					file_id: "file-2",
					file_name: "admin.html",
					file_extension: "html",
					relative_file_path: "admin.html",
				},
			],
		})

		renderPage()

		expect(await confirmSafetyNotice()).toHaveTextContent("index.html")
		expect(screen.getByTestId("mock-mounted-file-id")).toHaveTextContent("file-1")
		expect(screen.getByTestId("mock-html-preview")).toHaveAttribute(
			"data-virtual-storage-marker-id",
			"file-1",
		)

		fireEvent.click(screen.getByRole("button", { name: "navigate-admin" }))

		expect(screen.getByTestId("mock-html-preview")).toHaveTextContent("admin.html")
		expect(screen.getByTestId("mock-mounted-file-id")).toHaveTextContent("file-2")
		expect(screen.getByTestId("mock-html-preview")).toHaveAttribute(
			"data-virtual-storage-marker-id",
			"file-1",
		)

		fireEvent.click(screen.getByRole("button", { name: "navigate-index" }))

		expect(screen.getByTestId("mock-html-preview")).toHaveTextContent("index.html")
		expect(screen.getByTestId("mock-mounted-file-id")).toHaveTextContent("file-1")
	})

	it("shows empty state when published files do not contain a root html entry", async () => {
		mocks.loadShareFilesV2.mockResolvedValue({
			tree: [
				{
					file_id: "app-json-1",
					file_name: "app.json",
					file_extension: "json",
					relative_file_path: "app.json",
				},
				{
					file_id: "file-1",
					file_name: "readme.md",
					file_extension: "md",
					relative_file_path: "readme.md",
				},
			],
			list: [
				{
					file_id: "app-json-1",
					file_name: "app.json",
					file_extension: "json",
					relative_file_path: "app.json",
				},
				{
					file_id: "file-1",
					file_name: "readme.md",
					file_extension: "md",
					relative_file_path: "readme.md",
				},
			],
		})

		renderPage()

		expect(await screen.findByTestId("micro-app-share-empty")).toBeInTheDocument()
	})

	it("uses the micro app permission illustration when the share is unavailable", async () => {
		mocks.resolvePublishedMicroApp.mockRejectedValue(new Error("share unavailable"))

		renderPage()

		expect(await screen.findByTestId("mock-error-display")).toHaveTextContent(
			"microAppShare.errorTitle",
		)
		expect(screen.getByTestId("micro-app-share-error-illustration")).toHaveAttribute(
			"data-state",
			"permission",
		)
	})
})
