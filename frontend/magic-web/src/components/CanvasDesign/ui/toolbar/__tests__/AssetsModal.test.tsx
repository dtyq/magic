import { type ReactNode, useState } from "react"
import { createPortal } from "react-dom"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AssetItem } from "@/apis"
import AssetsModal from "../AssetsModal"
import { assetLibrarySessionStore } from "../../../runtime/resources/asset/AssetLibrarySessionStore"

const mocks = vi.hoisted(() => ({
	batchDeleteAssets: vi.fn(),
	getAssetOwners: vi.fn().mockResolvedValue([]),
	queryAssets: vi.fn(),
	transferAssetOwner: vi.fn(),
}))

vi.mock("@/models/user/hooks", () => ({
	useUserInfo: () => ({ userInfo: { user_id: "owner-1" } }),
}))

vi.mock("@/components/business/MemberDepartmentSelector", () => ({
	default: () => null,
}))

vi.mock("@/components/shadcn-ui/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuItem: ({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) => (
		<button type="button" role="menuitem" onClick={onSelect}>
			{children}
		</button>
	),
	DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/apis", () => ({
	AssetsApi: {
		batchDeleteAssets: mocks.batchDeleteAssets,
		getAssetOwners: mocks.getAssetOwners,
		queryAssets: mocks.queryAssets,
		transferAssetOwner: mocks.transferAssetOwner,
	},
}))

vi.mock("../../fullscreen/media-resource/index", () => ({
	default: ({ onClose }: { onClose: () => void }) =>
		createPortal(
			<div data-testid="fullscreen-preview-backdrop" onClick={onClose} role="presentation" />,
			document.body,
		),
}))

vi.mock("../asset-library/useAssetLibraryComplianceAction", () => ({
	canStartAssetLibraryCompliance: () => false,
	useAssetLibraryComplianceAction: () => ({
		startCompliance: vi.fn(),
	}),
}))

vi.mock("../../seedanceComplianceAvailability", () => ({
	useSeedanceComplianceAvailable: () => false,
}))

vi.mock("../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({
		t: (key: string, fallback?: string | Record<string, unknown>) => {
			if (typeof fallback === "string") return fallback
			if (fallback && typeof fallback === "object" && "defaultValue" in fallback) {
				return String(fallback.defaultValue).replace(
					/\{\{(count|max)\}\}/g,
					(_, name: "count" | "max") => String(fallback[name] ?? `{{${name}}}`),
				)
			}
			return key
		},
	}),
}))

const asset: AssetItem = {
	asset_id: "asset-1",
	asset_kind: "ASSET",
	asset_business_type: null,
	asset_media_type: "IMAGE",
	parent_id: null,
	name: "Portrait",
	description: "",
	file_url: "https://example.com/portrait.png",
	compliance_status: "PASS",
	compliance_failed_reason: null,
	owner: { id: "owner-1", name: "Alice" },
	owner_uid: "owner-1",
	source: "PERSONAL",
	tags: [],
}

function response(...items: AssetItem[]) {
	return { page: 1, page_size: 200, total: items.length, list: items }
}

describe("AssetsModal", () => {
	beforeEach(() => {
		assetLibrarySessionStore.clearAll()
		mocks.queryAssets.mockReset()
		mocks.getAssetOwners.mockReset().mockResolvedValue([])
		mocks.batchDeleteAssets.mockReset()
		mocks.transferAssetOwner.mockReset()
	})

	it("queries all allowed image and video assets in one request", async () => {
		const videoAsset: AssetItem = {
			...asset,
			asset_id: "asset-video",
			asset_media_type: "VIDEO",
			name: "Video",
			file_url: "https://example.com/video.mp4",
		}
		mocks.queryAssets.mockResolvedValueOnce({
			page: 1,
			page_size: 200,
			total: 2,
			list: [videoAsset, asset],
		})

		render(<AssetsModal open onClose={vi.fn()} mediaTypes={["IMAGE", "VIDEO"]} />)

		await screen.findByText(videoAsset.name)
		expect(screen.getAllByText(asset.name)).toHaveLength(1)
		expect(mocks.queryAssets).toHaveBeenCalledTimes(1)
		expect(mocks.queryAssets.mock.calls[0][0]).not.toHaveProperty("asset_media_type")
	})

	it("keeps the asset library dialog below the shared toast layer", async () => {
		mocks.queryAssets.mockResolvedValueOnce(response(asset))

		render(<AssetsModal open onClose={vi.fn()} />)

		expect(await screen.findByTestId("assets-modal")).toHaveStyle({ zIndex: "999" })
	})

	it("closes only the fullscreen preview when its backdrop is clicked", async () => {
		mocks.queryAssets.mockResolvedValueOnce(response(asset))

		function Harness() {
			const [open, setOpen] = useState(true)
			return <AssetsModal open={open} onClose={() => setOpen(false)} />
		}

		render(<Harness />)
		await screen.findByText(asset.name)

		fireEvent.click(screen.getByRole("button", { name: "放大预览" }))
		const previewBackdrop = await screen.findByTestId("fullscreen-preview-backdrop")
		fireEvent.pointerDown(previewBackdrop)
		fireEvent.click(previewBackdrop)

		await waitFor(() =>
			expect(screen.queryByTestId("fullscreen-preview-backdrop")).not.toBeInTheDocument(),
		)
		expect(screen.getByTestId("assets-modal")).toBeInTheDocument()
	})

	it("returns the selected asset without downloading or uploading it", async () => {
		mocks.queryAssets.mockResolvedValueOnce({
			page: 1,
			page_size: 200,
			total: 1,
			list: [asset],
		})
		const onClose = vi.fn()
		const onConfirm = vi.fn()

		render(<AssetsModal open onClose={onClose} onConfirm={onConfirm} />)

		await screen.findByText(asset.name)
		expect(screen.getByRole("img", { name: asset.name })).toHaveClass("object-contain")
		const assetCard = screen.getByText(asset.name).closest('[role="button"]')
		expect(assetCard).toBeTruthy()
		if (!assetCard) throw new Error("Asset card was not rendered")

		fireEvent.click(assetCard)
		fireEvent.click(screen.getByRole("button", { name: "应用至画布" }))

		await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(asset))
		expect(onClose).toHaveBeenCalledTimes(1)
		expect(mocks.queryAssets).toHaveBeenCalledWith(
			expect.objectContaining({ asset_media_type: "IMAGE" }),
		)
	})

	it("supports multi-select and enforces the caller-provided maximum", async () => {
		const secondAsset = { ...asset, asset_id: "asset-2", name: "Portrait 2" }
		const thirdAsset = { ...asset, asset_id: "asset-3", name: "Portrait 3" }
		mocks.queryAssets.mockResolvedValueOnce(response(asset, secondAsset, thirdAsset))
		const onConfirmMultiple = vi.fn()

		render(
			<AssetsModal
				open
				onClose={vi.fn()}
				onConfirmMultiple={onConfirmMultiple}
				multiple
				maxCount={2}
			/>,
		)

		const firstCard = (await screen.findByText(asset.name)).closest('[role="button"]')
		const secondCard = screen.getByText(secondAsset.name).closest('[role="button"]')
		const thirdCard = screen.getByText(thirdAsset.name).closest('[role="button"]')
		if (!firstCard || !secondCard || !thirdCard) {
			throw new Error("Asset cards were not rendered")
		}
		fireEvent.click(firstCard)
		fireEvent.click(secondCard)
		fireEvent.click(thirdCard)

		expect(screen.getByText("已选 2")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "应用至画布" }))

		await waitFor(() => expect(onConfirmMultiple).toHaveBeenCalledWith([asset, secondAsset]))
	})

	it("batch deletes selected owned assets from the library", async () => {
		const secondAsset = { ...asset, asset_id: "asset-2", name: "Portrait 2" }
		mocks.queryAssets.mockResolvedValue(response(asset, secondAsset))
		mocks.batchDeleteAssets.mockResolvedValue({
			deleted_num: 2,
			asset_ids: [asset.asset_id, secondAsset.asset_id],
		})

		render(<AssetsModal open onClose={vi.fn()} multiple />)
		const firstCard = (await screen.findByText(asset.name)).closest('[role="button"]')
		const secondCard = screen.getByText(secondAsset.name).closest('[role="button"]')
		if (!firstCard || !secondCard) throw new Error("Asset cards were not rendered")
		fireEvent.click(firstCard)
		fireEvent.click(secondCard)
		fireEvent.pointerDown(screen.getByRole("button", { name: "批量操作" }), {
			button: 0,
		})
		fireEvent.click(await screen.findByRole("menuitem", { name: "批量删除" }))

		await waitFor(() =>
			expect(mocks.batchDeleteAssets).toHaveBeenCalledWith({
				asset_ids: [asset.asset_id, secondAsset.asset_id],
			}),
		)
	})

	it("reuses the page-session cache after reopening and clears the previous selection", async () => {
		mocks.queryAssets.mockResolvedValueOnce(response(asset))
		const { rerender } = render(<AssetsModal open onClose={vi.fn()} />)

		const assetCard = (await screen.findByText(asset.name)).closest('[role="button"]')
		if (!assetCard) throw new Error("Asset card was not rendered")
		fireEvent.click(assetCard)
		expect(screen.getByRole("button", { name: "应用至画布" })).not.toBeDisabled()

		rerender(<AssetsModal open={false} onClose={vi.fn()} />)
		rerender(<AssetsModal open onClose={vi.fn()} />)
		await screen.findByText(asset.name)

		expect(screen.getByRole("button", { name: "应用至画布" })).toBeDisabled()
		expect(mocks.queryAssets).toHaveBeenCalledTimes(1)
		// The small portrait library keeps the owner list warm with the modal session.
		expect(mocks.getAssetOwners).toHaveBeenCalledTimes(1)
	})

	it("refreshes the current query while keeping the old list visible", async () => {
		const refreshedAsset = { ...asset, name: "Updated portrait" }
		let resolveRefresh: ((value: ReturnType<typeof response>) => void) | undefined
		mocks.queryAssets.mockResolvedValueOnce(response(asset)).mockReturnValueOnce(
			new Promise((resolve) => {
				resolveRefresh = resolve
			}),
		)

		render(<AssetsModal open onClose={vi.fn()} />)
		await screen.findByText(asset.name)
		fireEvent.click(screen.getByRole("button", { name: "刷新素材" }))

		expect(screen.getByText(asset.name)).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "刷新素材" })).toBeDisabled()
		resolveRefresh?.(response(refreshedAsset))
		await screen.findByText(refreshedAsset.name)
		expect(mocks.queryAssets).toHaveBeenCalledTimes(2)
	})

	it("revalidates an open modal after an external asset mutation", async () => {
		const refreshedAsset = { ...asset, name: "Saved from canvas" }
		mocks.queryAssets
			.mockResolvedValueOnce(response(asset))
			.mockResolvedValueOnce(response(refreshedAsset))

		render(<AssetsModal open onClose={vi.fn()} />)
		await screen.findByText(asset.name)

		act(() => assetLibrarySessionStore.invalidateCurrentScope())

		await screen.findByText(refreshedAsset.name)
		expect(mocks.queryAssets).toHaveBeenCalledTimes(2)
	})

	it("keeps the old list and reports an error when refresh fails", async () => {
		mocks.queryAssets
			.mockResolvedValueOnce(response(asset))
			.mockRejectedValueOnce(new Error("refresh failed"))

		render(<AssetsModal open onClose={vi.fn()} />)
		await screen.findByText(asset.name)
		fireEvent.click(screen.getByRole("button", { name: "刷新素材" }))

		expect(await screen.findByRole("alert")).toHaveTextContent("素材库加载失败，请重试")
		expect(screen.getByText(asset.name)).toBeInTheDocument()
	})

	it("keeps the modal open and reports a failed confirmation", async () => {
		mocks.queryAssets.mockResolvedValueOnce({
			page: 1,
			page_size: 200,
			total: 1,
			list: [asset],
		})
		let rejectConfirm: ((reason?: unknown) => void) | undefined
		const onConfirm = vi.fn(
			() =>
				new Promise<void>((_resolve, reject) => {
					rejectConfirm = reject
				}),
		)
		const onClose = vi.fn()

		render(<AssetsModal open onClose={onClose} onConfirm={onConfirm} />)

		const assetCard = (await screen.findByText(asset.name)).closest('[role="button"]')
		if (!assetCard) throw new Error("Asset card was not rendered")
		fireEvent.click(assetCard)
		fireEvent.click(screen.getByRole("button", { name: "应用至画布" }))

		expect(await screen.findByRole("button", { name: "应用中..." })).toBeDisabled()
		await act(async () => rejectConfirm?.(new Error("import failed")))

		expect(await screen.findByRole("alert")).toHaveTextContent("素材选择失败，请重试")
		expect(onClose).not.toHaveBeenCalled()
	})

	it("requests only PASS assets when compliance is required", async () => {
		mocks.queryAssets.mockResolvedValue({
			page: 1,
			page_size: 200,
			total: 0,
			list: [],
		})

		render(<AssetsModal open onClose={vi.fn()} requiresCompliance />)
		await waitFor(() =>
			expect(mocks.queryAssets).toHaveBeenCalledWith(
				expect.objectContaining({ compliance_status: "PASS" }),
			),
		)

		expect(mocks.queryAssets).toHaveBeenCalledTimes(1)
	})
})
