import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SaveAssetToLibraryDialog from "../SaveAssetToLibraryDialog"

const mocks = vi.hoisted(() => ({
	getAssetTags: vi.fn(),
	toastSuccess: vi.fn(),
	toastWarning: vi.fn(),
	toastError: vi.fn(),
}))

vi.mock("@/apis", () => ({
	AssetsApi: {
		getAssetTags: mocks.getAssetTags,
	},
}))

vi.mock("@/components/business/MemberDepartmentSelector", () => ({
	default: ({
		open,
		selectedValues,
		onSelectChange,
		onOk,
		onCancel,
	}: {
		open: boolean
		selectedValues?: Array<Record<string, unknown>>
		onSelectChange?: (values: Array<Record<string, unknown>>) => void
		onOk?: (values: Array<Record<string, unknown>>) => void
		onCancel?: () => void
	}) =>
		open ? (
			<div>
				<div data-testid="selector-selected-values">
					{selectedValues?.map((value) => String(value.id)).join(",")}
				</div>
				<button
					type="button"
					onClick={() =>
						onSelectChange?.([
							{
								id: "selector-record-1",
								department_id: "department-1",
								name: "Design",
								dataType: "department",
							},
						])
					}
				>
					choose-target
				</button>
				<button
					type="button"
					onClick={() => {
						onOk?.([
							{
								id: "selector-record-1",
								department_id: "department-1",
								name: "Design",
								dataType: "department",
							},
						])
						onCancel?.()
					}}
				>
					confirm-target
				</button>
				<button type="button" onClick={onCancel}>
					cancel-target
				</button>
			</div>
		) : null,
}))

vi.mock("sonner", () => ({
	toast: {
		success: mocks.toastSuccess,
		warning: mocks.toastWarning,
		error: mocks.toastError,
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

describe("SaveAssetToLibraryDialog", () => {
	beforeEach(() => {
		window.HTMLElement.prototype.scrollIntoView = vi.fn()
		mocks.getAssetTags.mockReset().mockResolvedValue([])
		mocks.toastSuccess.mockReset()
		mocks.toastWarning.mockReset()
		mocks.toastError.mockReset()
	})

	it("waits for explicit confirmation before saving the workspace image", async () => {
		const onSave = vi.fn().mockResolvedValue({
			assetId: "asset-1",
			mediaType: "image",
			fileUrl: null,
		})
		const onClose = vi.fn()
		const onBindSavedAsset = vi.fn().mockReturnValue("bound")

		render(
			<SaveAssetToLibraryDialog
				open
				source={{
					elementId: "image-1",
					contentId: "content-1",
					path: "./images/portrait.png",
					name: "portrait",
				}}
				onClose={onClose}
				getPreviewUrl={vi.fn().mockResolvedValue("https://example.com/portrait.png")}
				onSave={onSave}
				onBindSavedAsset={onBindSavedAsset}
			/>,
		)

		expect(screen.getByTestId("save-asset-to-library-dialog")).toHaveClass(
			"max-h-[calc(100vh-40px)]",
			"max-w-[780px]",
			"flex-col",
			"sm:max-w-[780px]",
		)
		await waitFor(() => expect(mocks.getAssetTags).toHaveBeenCalledTimes(1))
		await waitFor(() =>
			expect(screen.getByRole("img")).toHaveClass("absolute", "inset-0", "object-contain"),
		)
		expect(onSave).not.toHaveBeenCalled()

		fireEvent.click(
			screen.getByRole("button", {
				name: /保存素材|Save asset|assetLibrarySave\.save/,
			}),
		)

		await waitFor(() =>
			expect(onSave).toHaveBeenCalledWith({
				elementId: "image-1",
				contentId: "content-1",
				path: "./images/portrait.png",
				name: "portrait",
				description: null,
				userIds: undefined,
				departmentIds: undefined,
				tagIds: undefined,
			}),
		)
		expect(onBindSavedAsset).toHaveBeenCalledWith({
			elementId: "image-1",
			contentId: "content-1",
			sourcePath: "./images/portrait.png",
			assetId: "asset-1",
		})
		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it("closes with a warning when the saved image Content can no longer be bound", async () => {
		const onClose = vi.fn()
		const onBindSavedAsset = vi.fn().mockReturnValue("source-changed")

		render(
			<SaveAssetToLibraryDialog
				open
				source={{
					elementId: "image-4",
					contentId: "content-4",
					path: "./images/changed.png",
					name: "changed",
				}}
				onClose={onClose}
				getPreviewUrl={vi.fn().mockResolvedValue(undefined)}
				onSave={vi.fn().mockResolvedValue({
					assetId: "asset-4",
					mediaType: "image",
					fileUrl: null,
				})}
				onBindSavedAsset={onBindSavedAsset}
			/>,
		)

		await waitFor(() => expect(screen.getByDisplayValue("changed")).toBeVisible())
		fireEvent.click(screen.getByRole("button", { name: "assetLibrarySave.save" }))

		await waitFor(() =>
			expect(mocks.toastWarning).toHaveBeenCalledWith("assetLibrarySave.bindingSkipped"),
		)
		expect(mocks.toastSuccess).not.toHaveBeenCalled()
		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it("does not reload the preview when the host callback reference changes", async () => {
		const firstPreviewLoader = vi.fn().mockResolvedValue("https://example.com/portrait.png")
		const secondPreviewLoader = vi.fn().mockResolvedValue("https://example.com/portrait-v2.png")
		const props = {
			open: true,
			source: {
				elementId: "image-1",
				contentId: "content-1",
				path: "./images/portrait.png",
				name: "portrait",
			},
			onClose: vi.fn(),
			onBindSavedAsset: vi.fn().mockReturnValue("bound" as const),
			onSave: vi.fn().mockResolvedValue({
				assetId: "asset-1",
				mediaType: "image" as const,
				fileUrl: null,
			}),
		}
		const { rerender } = render(
			<SaveAssetToLibraryDialog {...props} getPreviewUrl={firstPreviewLoader} />,
		)

		await waitFor(() => expect(firstPreviewLoader).toHaveBeenCalledTimes(1))
		rerender(<SaveAssetToLibraryDialog {...props} getPreviewUrl={secondPreviewLoader} />)

		expect(firstPreviewLoader).toHaveBeenCalledTimes(1)
		expect(secondPreviewLoader).not.toHaveBeenCalled()
	})

	it("requires and submits explicit team visibility targets", async () => {
		const onSave = vi.fn().mockResolvedValue({
			assetId: "asset-2",
			mediaType: "image",
			fileUrl: null,
		})
		const onClose = vi.fn()
		const onBindSavedAsset = vi.fn().mockReturnValue("bound")

		render(
			<SaveAssetToLibraryDialog
				open
				source={{
					elementId: "image-2",
					contentId: "content-2",
					path: "./images/team.png",
					name: "team",
				}}
				onClose={onClose}
				getPreviewUrl={vi.fn().mockResolvedValue(undefined)}
				onSave={onSave}
				onBindSavedAsset={onBindSavedAsset}
			/>,
		)

		await waitFor(() => expect(mocks.getAssetTags).toHaveBeenCalledTimes(1))
		fireEvent.click(screen.getByRole("button", { name: "assetLibrarySave.teamVisibility" }))
		fireEvent.click(screen.getByRole("button", { name: "assetLibrarySave.selectTargets" }))
		const selectorButton = screen.getByRole("button", { name: "choose-target", hidden: true })
		fireEvent.pointerDown(selectorButton)
		expect(onClose).not.toHaveBeenCalled()
		fireEvent.click(selectorButton)
		fireEvent.click(screen.getByRole("button", { name: "assetLibrarySave.save" }))
		expect(onSave).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole("button", { name: "confirm-target", hidden: true }))
		fireEvent.click(screen.getByRole("button", { name: "assetLibrarySave.save" }))

		await waitFor(() =>
			expect(onSave).toHaveBeenCalledWith({
				elementId: "image-2",
				contentId: "content-2",
				path: "./images/team.png",
				name: "team",
				description: null,
				userIds: [],
				departmentIds: ["department-1"],
				tagIds: undefined,
			}),
		)
	})

	it("keeps confirmed visibility targets when the selector closes after confirming", async () => {
		render(
			<SaveAssetToLibraryDialog
				open
				source={{
					elementId: "image-reopen",
					contentId: "content-reopen",
					path: "./images/reopen.png",
					name: "reopen",
				}}
				onClose={vi.fn()}
				getPreviewUrl={vi.fn().mockResolvedValue(undefined)}
				onSave={vi.fn().mockResolvedValue({
					assetId: "asset-reopen",
					mediaType: "image",
					fileUrl: null,
				})}
				onBindSavedAsset={vi.fn().mockReturnValue("bound")}
			/>,
		)

		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "assetLibrarySave.teamVisibility" }))
		})
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "assetLibrarySave.selectTargets" }))
		})
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "confirm-target", hidden: true }))
		})

		expect(screen.getByText("Design")).toBeVisible()
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "assetLibrarySave.selectTargets" }))
		})

		expect(screen.getByTestId("selector-selected-values")).toHaveTextContent(
			"selector-record-1",
		)
	})

	it("edits asset metadata and submits complete visibility and tag arrays", async () => {
		const onUpdateAsset = vi.fn().mockResolvedValue(undefined)
		const onClose = vi.fn()

		render(
			<SaveAssetToLibraryDialog
				open
				source={{
					assetId: "asset-edit-1",
					name: "旧名称",
					description: "旧描述",
					fileUrl: "https://example.com/asset.png",
					mediaType: "image",
					visibility: "private",
					userIds: ["user-1"],
					departmentIds: [],
					visibilityTargets: [{ id: "user-1", name: "Alice", type: "user" }],
					visibilityEditable: true,
					tagIds: [],
				}}
				onClose={onClose}
				getPreviewUrl={vi.fn().mockResolvedValue(undefined)}
				onSave={vi.fn()}
				onUpdateAsset={onUpdateAsset}
				onBindSavedAsset={vi.fn().mockReturnValue("bound")}
			/>,
		)

		await waitFor(() => expect(mocks.getAssetTags).toHaveBeenCalledTimes(1))
		fireEvent.change(screen.getByDisplayValue("旧名称"), {
			target: { value: "新名称" },
		})
		fireEvent.change(screen.getByDisplayValue("旧描述"), {
			target: { value: "新描述" },
		})
		fireEvent.click(screen.getByRole("button", { name: "assetLibrarySave.teamVisibility" }))
		fireEvent.click(screen.getByRole("button", { name: "assetLibrarySave.selectTargets" }))
		fireEvent.click(screen.getByRole("button", { name: "confirm-target", hidden: true }))
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "assetLibrarySave.save" }))
			await Promise.resolve()
		})
		expect(onUpdateAsset).toHaveBeenCalledWith("asset-edit-1", {
			name: "新名称",
			description: "新描述",
			userIds: [],
			departmentIds: ["department-1"],
			tagIds: [],
		})
		expect(onClose).toHaveBeenCalledTimes(1)
		expect(mocks.toastSuccess).toHaveBeenCalledWith("assetLibrarySave.editSuccess")
	})

	it("clears existing team visibility when switching an asset to private", async () => {
		const onUpdateAsset = vi.fn().mockResolvedValue(undefined)

		render(
			<SaveAssetToLibraryDialog
				open
				source={{
					assetId: "asset-edit-2",
					name: "团队素材",
					description: "描述",
					fileUrl: "https://example.com/asset.png",
					mediaType: "image",
					visibility: "team",
					userIds: ["user-1"],
					departmentIds: ["department-1"],
					visibilityTargets: [
						{ id: "user-1", name: "Alice", type: "user" },
						{ id: "department-1", name: "Design", type: "department" },
					],
					visibilityEditable: true,
					tagIds: ["tag-1"],
				}}
				onClose={vi.fn()}
				getPreviewUrl={vi.fn().mockResolvedValue(undefined)}
				onSave={vi.fn()}
				onUpdateAsset={onUpdateAsset}
				onBindSavedAsset={vi.fn().mockReturnValue("bound")}
			/>,
		)

		await waitFor(() => expect(mocks.getAssetTags).toHaveBeenCalledTimes(1))
		fireEvent.click(screen.getByRole("button", { name: "assetLibrarySave.privateVisibility" }))
		fireEvent.click(screen.getByRole("button", { name: "assetLibrarySave.save" }))

		await waitFor(() =>
			expect(onUpdateAsset).toHaveBeenCalledWith("asset-edit-2", {
				name: "团队素材",
				description: "描述",
				userIds: [],
				departmentIds: [],
				tagIds: ["tag-1"],
			}),
		)
	})

	it("selects multiple tags, removes one, and submits the remaining tag ids", async () => {
		mocks.getAssetTags.mockResolvedValue([
			{
				id: "group-1",
				name: "People",
				tags: [
					{ id: "tag-1", name: "Portrait" },
					{ id: "tag-2", name: "Character" },
				],
			},
		])
		// This case only verifies the submitted tag IDs; leave saving pending so closing the
		// Radix dialog does not add animation timing to the select interaction assertion.
		const onSave = vi.fn().mockReturnValue(new Promise<never>(() => undefined))

		const { unmount } = render(
			<SaveAssetToLibraryDialog
				open
				source={{
					elementId: "image-3",
					contentId: "content-3",
					path: "./images/tags.png",
					name: "tags",
				}}
				onClose={vi.fn()}
				getPreviewUrl={vi.fn().mockResolvedValue(undefined)}
				onSave={onSave}
				onBindSavedAsset={vi.fn().mockReturnValue("bound")}
			/>,
		)

		await waitFor(() =>
			expect(screen.getByText("assetLibrarySave.tagsPlaceholder")).toBeVisible(),
		)
		fireEvent.click(screen.getByRole("combobox", { name: "assetLibrarySave.tagsLabel" }))
		fireEvent.click(screen.getByText("Portrait"))
		fireEvent.click(screen.getByText("Character"))

		expect(screen.getByLabelText("assetLibrarySave.removeTag: Portrait")).toBeVisible()
		expect(screen.getByLabelText("assetLibrarySave.removeTag: Character")).toBeVisible()
		fireEvent.click(screen.getByLabelText("assetLibrarySave.removeTag: Portrait"))
		fireEvent.click(screen.getByRole("button", { name: "assetLibrarySave.save" }))

		expect(onSave).toHaveBeenCalledWith({
			elementId: "image-3",
			contentId: "content-3",
			path: "./images/tags.png",
			name: "tags",
			description: null,
			userIds: undefined,
			departmentIds: undefined,
			tagIds: ["tag-2"],
		})
		unmount()
	})
})
