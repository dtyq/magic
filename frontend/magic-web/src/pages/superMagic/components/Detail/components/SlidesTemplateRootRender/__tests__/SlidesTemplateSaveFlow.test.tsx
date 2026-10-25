import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useSlidesTemplateSaveFlow } from "../SlidesTemplateSaveFlow"
import type { SlidesTemplateProjectContext } from "../types"

const mocks = vi.hoisted(() => ({
	adapter: { saveEnabled: true },
	checkByCode: vi.fn(),
	createAvailableSlidesTemplateCode: vi.fn(),
	listMine: vi.fn(),
	loadDetail: vi.fn(),
	saveFromFolder: vi.fn(),
	toastInfo: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
	createRandomUuidV4: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
}))

vi.mock("@/pages/superMagic/services/mySlidesTemplateAdapter", () => ({
	mySlidesTemplateAdapter: {
		enabled: true,
		get saveEnabled() {
			return mocks.adapter.saveEnabled
		},
		checkByCode: mocks.checkByCode,
		createAvailableSlidesTemplateCode: mocks.createAvailableSlidesTemplateCode,
		listMine: mocks.listMine,
		loadDetail: mocks.loadDetail,
		saveFromFolder: mocks.saveFromFolder,
	},
	createAvailableSlidesTemplateCode: mocks.createAvailableSlidesTemplateCode,
	MySlidesTemplateAdapterUnavailableError: class extends Error {},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		info: mocks.toastInfo,
		success: mocks.toastSuccess,
		error: mocks.toastError,
	},
}))

vi.mock("@/utils/create-random-uuid-v4", () => ({
	createRandomUuidV4: mocks.createRandomUuidV4,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en_US" } }),
}))

const project = {
	rootFileId: "folder-1",
	rootPath: "示例模板",
	root: { file_id: "folder-1", file_name: "示例模板" },
} as SlidesTemplateProjectContext

function Harness() {
	const flow = useSlidesTemplateSaveFlow({
		project,
		projectId: "project-1",
	})
	return (
		<div>
			<button type="button" onClick={() => void flow.startSave()}>
				start
			</button>
			{flow.dialogs}
		</div>
	)
}

describe("useSlidesTemplateSaveFlow", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.adapter.saveEnabled = true
		mocks.checkByCode.mockResolvedValue({ status: "UNUSED" })
		mocks.createAvailableSlidesTemplateCode.mockResolvedValue("SLIDE-11111111")
		mocks.listMine.mockResolvedValue({ items: [], page: 1, pageSize: 100, hasMore: false })
		mocks.loadDetail.mockResolvedValue({ id: "existing-1" })
		mocks.saveFromFolder.mockResolvedValue({ id: "saved", name: "Saved" })
	})

	it("shows the save dialog instead of an unavailable toast", async () => {
		mocks.adapter.saveEnabled = false
		render(<Harness />)
		fireEvent.click(screen.getByRole("button", { name: "start" }))

		expect(await screen.findByText("mySlidesTemplates.saveDialog.title")).toBeInTheDocument()
		expect(screen.getByText("slidesTemplatePreview.save.unavailable")).toBeInTheDocument()
		expect(mocks.toastInfo).not.toHaveBeenCalled()
	})

	it("saves directly when the template does not already exist", async () => {
		render(<Harness />)
		fireEvent.click(screen.getByRole("button", { name: "start" }))

		await screen.findByText("mySlidesTemplates.saveDialog.title")
		fireEvent.click(screen.getByRole("button", { name: "mySlidesTemplates.saveDialog.create" }))
		await waitFor(() =>
			expect(mocks.saveFromFolder).toHaveBeenCalledWith({
				projectId: "project-1",
				directoryId: "folder-1",
				code: "SLIDE-11111111",
			}),
		)
		expect(mocks.toastSuccess).toHaveBeenCalled()
	})

	it("reports a direct upload failure without showing success", async () => {
		mocks.saveFromFolder.mockRejectedValueOnce(new Error("upload failed"))
		render(<Harness />)
		fireEvent.click(screen.getByRole("button", { name: "start" }))
		await screen.findByText("mySlidesTemplates.saveDialog.title")
		fireEvent.click(screen.getByRole("button", { name: "mySlidesTemplates.saveDialog.create" }))

		await waitFor(() =>
			expect(mocks.toastError).toHaveBeenCalledWith("slidesTemplatePreview.save.failed"),
		)
		expect(mocks.toastSuccess).not.toHaveBeenCalled()
	})

	it("uses the selected template code when overwriting", async () => {
		mocks.listMine.mockResolvedValueOnce({
			items: [
				{
					code: "SLIDE-existing",
					label: { zh_CN: "已有模板", en_US: "Existing" },
				},
			],
			page: 1,
			pageSize: 100,
			hasMore: false,
		})
		render(<Harness />)
		fireEvent.click(screen.getByRole("button", { name: "start" }))

		await screen.findByText("mySlidesTemplates.saveDialog.title")
		fireEvent.click(screen.getByRole("radio", { name: "Existing" }))
		fireEvent.click(
			screen.getByRole("button", { name: "mySlidesTemplates.saveDialog.overwrite" }),
		)
		await waitFor(() =>
			expect(mocks.saveFromFolder).toHaveBeenCalledWith(
				expect.objectContaining({
					projectId: "project-1",
					directoryId: "folder-1",
					code: "SLIDE-existing",
				}),
			),
		)
	})
})
