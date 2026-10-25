import { fireEvent, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	getMicroAppSharePageMocks,
	renderPage,
	resetMicroAppSharePageMocks,
} from "./MicroAppSharePage.testUtils"

const mocks = getMicroAppSharePageMocks()

async function confirmSafetyNotice() {
	expect(await screen.findByTestId("micro-app-share-safety-notice")).toBeInTheDocument()
	fireEvent.click(screen.getByTestId("micro-app-share-safety-confirm"))
	return screen.findByTestId("mock-html-preview")
}

describe("MicroAppSharePage lifecycle", () => {
	beforeEach(resetMicroAppSharePageMocks)

	it("requires a new confirmation after switching to another shared app", async () => {
		renderPage()
		await confirmSafetyNotice()

		fireEvent.click(screen.getByTestId("navigate-to-second-micro-app"))

		await waitFor(() => {
			expect(mocks.resolvePublishedMicroApp).toHaveBeenCalledWith("app-2")
			expect(mocks.getShareResource).toHaveBeenCalledTimes(2)
		})
		expect(await screen.findByTestId("micro-app-share-safety-notice")).toBeInTheDocument()
		expect(screen.queryByTestId("mock-html-preview")).not.toBeInTheDocument()
	})

	it("ignores a stale file response after switching shared apps", async () => {
		let resolveFirstFiles: (value: {
			tree: Array<Record<string, string>>
			list: Array<Record<string, string>>
		}) => void = () => undefined
		const firstFiles = new Promise<{
			tree: Array<Record<string, string>>
			list: Array<Record<string, string>>
		}>((resolve) => {
			resolveFirstFiles = resolve
		})
		const buildFiles = (suffix: string) => ({
			tree: [
				{
					file_id: `app-json-${suffix}`,
					file_name: "app.json",
					file_extension: "json",
					relative_file_path: "app.json",
				},
				{
					file_id: `file-${suffix}`,
					file_name: "index.html",
					file_extension: "html",
					relative_file_path: "index.html",
				},
			],
			list: [
				{
					file_id: `app-json-${suffix}`,
					file_name: "app.json",
					file_extension: "json",
					relative_file_path: "app.json",
				},
				{
					file_id: `file-${suffix}`,
					file_name: "index.html",
					file_extension: "html",
					relative_file_path: "index.html",
				},
			],
		})

		mocks.resolvePublishedMicroApp.mockImplementation(async (requestedAppId: string) => ({
			app_id: requestedAppId,
			resource_id: `resource-${requestedAppId}`,
		}))
		mocks.getShareResource.mockImplementation(
			async ({ resource_id }: { resource_id: string }) => ({
				temporary_token: `token-${resource_id}`,
				data: {
					project_id: `project-${resource_id}`,
					project_name: resource_id,
				},
			}),
		)
		mocks.loadShareFilesV2.mockImplementation(({ resourceId }: { resourceId: string }) =>
			resourceId === "resource-app-1" ? firstFiles : Promise.resolve(buildFiles("app-2")),
		)

		renderPage()
		await waitFor(() => {
			expect(mocks.loadShareFilesV2).toHaveBeenCalledWith({
				resourceId: "resource-app-1",
				password: undefined,
			})
		})

		fireEvent.click(screen.getByTestId("navigate-to-second-micro-app"))
		expect(await confirmSafetyNotice()).toHaveAttribute(
			"data-virtual-storage-marker-id",
			"file-app-2",
		)

		resolveFirstFiles(buildFiles("app-1"))

		await waitFor(() => {
			expect(screen.getByTestId("mock-mounted-file-id")).toHaveTextContent("file-app-2")
		})
	})

	it("redirects to login when app.json does not allow anonymous access", async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			json: vi.fn().mockResolvedValue({ type: "micro-app", anonymous: false }),
		} as unknown as Response)

		renderPage()

		await waitFor(() => {
			expect(mocks.historyReplace).toHaveBeenCalledWith(
				expect.objectContaining({ name: "Login" }),
			)
		})
		expect(screen.queryByTestId("mock-html-preview")).not.toBeInTheDocument()
	})
})
