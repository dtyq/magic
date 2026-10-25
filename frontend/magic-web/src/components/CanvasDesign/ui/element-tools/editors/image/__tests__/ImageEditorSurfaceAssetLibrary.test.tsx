import { act, fireEvent, render, screen } from "@testing-library/react"
import { createRef, type ForwardedRef, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { AssetItem } from "@/apis"
import type { ImageEditorConfig } from "../useImageEditorConfig"
import type { MessageEditorRef } from "../../../../editors/message/MessageEditor"
import ImageEditorSurface from "../ImageEditorSurface"

type AssetsModalHarnessProps = {
	open: boolean
	onClose: () => void
	onConfirmMultiple?: (assets: AssetItem[]) => void | Promise<void>
	mediaTypes?: readonly string[]
	multiple?: boolean
	maxCount?: number
}

const mocks = vi.hoisted(() => ({
	assetImportMany: vi.fn(),
	assetsModalProps: null as AssetsModalHarnessProps | null,
	confirmAssets: [] as AssetItem[],
	currentElement: null as {
		id: string
		type: "image"
		activeContentId: string
	} | null,
	resolveResourceReference: vi.fn(),
	setEditingElementId: vi.fn(),
}))

vi.mock("@/apis", () => ({ AssetsApi: {} }))

const canvas = {
	isDestroyed: false,
	assetImportManager: {
		importAndConnectMany: mocks.assetImportMany,
	},
	elementManager: {
		getElementData: () => mocks.currentElement,
	},
	canvasFileUploadManager: {
		isPendingResourcePath: () => false,
	},
	magicConfigManager: {
		config: { methods: { resolveResourceReference: mocks.resolveResourceReference } },
	},
	eventEmitter: {
		on: () => vi.fn(),
	},
}

vi.mock("../../../../../app/providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas }),
}))

vi.mock("../../../../../app/providers/CanvasUIProvider", () => ({
	useCanvasModeUI: () => ({ setEditingElementId: mocks.setEditingElementId }),
}))

vi.mock("../../../../../app/providers/I18nProvider", () => ({
	useCanvasDesignI18n: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}))

vi.mock("../../../../../app/providers/HostUiLocaleProvider", () => ({
	useHostUiLocale: () => "zh_CN",
}))

vi.mock("../../../../../app/providers/MagicProvider", () => ({
	useMagic: () => ({ methods: { resolveResourceReference: mocks.resolveResourceReference } }),
}))

vi.mock("../../../../../app/hooks/layout/useElementPositionEffect", () => ({
	default: () => ({ containerRef: { current: null } }),
}))

vi.mock("../../../../../app/hooks/layout/useFloatingComponent", () => ({
	useFloatingComponent: () => ({ containerRef: { current: null } }),
}))

vi.mock("../../../../../app/providers/BottomFloatingStackProvider", () => ({
	useBottomFloatingSurface: () => ({ stackOffset: 0, containerRef: vi.fn() }),
}))

vi.mock("../../../../primitives/shadcn/popover", () => ({
	FloatingSurfaceScope: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("../../../../editors/message/MessageEditor", async () => {
	const { forwardRef, useImperativeHandle } = await import("react")
	return {
		default: forwardRef(function MessageEditorMock(_props, ref) {
			useImperativeHandle(ref, () => ({
				getCurrentPrompt: () => "",
				getMentionBindings: () => [],
				getSelectionRange: () => null,
				hasPendingUploadMentions: () => false,
				insertMentionItems: () => true,
			}))
			return null
		}),
	}
})

vi.mock("../../../../editors/message/useCanvasReferenceMention", () => ({
	useCanvasReferenceMention: () => ({
		matchableItems: [],
		mentionDataService: undefined,
		mentionExtension: undefined,
		mentionEnabled: true,
	}),
}))

vi.mock("../../../../editors/message/useMentionSync", () => ({
	useMentionSync: () => ({ syncMentionPaths: vi.fn() }),
}))

vi.mock("../../../../editors/message/reference-assets/ReferenceResourceDropSurface", async () => {
	const { forwardRef } = await import("react")
	return {
		ReferenceResourceDropSurface: forwardRef(function ReferenceResourceDropSurfaceMock(
			{ children }: { children: ReactNode },
			ref: ForwardedRef<HTMLDivElement>,
		) {
			return <div ref={ref}>{children}</div>
		}),
	}
})

vi.mock(
	"../../../../editors/message/reference-assets/useReferenceResourcePanelDataService",
	() => ({
		useReferenceResourceDrop: () => ({ overlayState: undefined, dragEvents: {} }),
		REFERENCE_RESOURCE_DROP_STATUS: { notAvailable: "not-available" },
	}),
)

vi.mock("../../../../editors/connection/useLinkedMediaAssociationController", () => ({
	useLinkedMediaAssociationController: () => ({
		linkedEditorInputs: {
			activeMediaReferences: [],
			textPrompt: "",
			textConnections: [],
			mediaItems: [],
		},
		handleMentionChange: vi.fn(() => true),
		handleLinkedMediaSelectionChange: vi.fn(),
	}),
}))

vi.mock("../ImageEditorControls", () => ({
	default: ({
		onSelectSource,
		renderSendButton,
	}: {
		onSelectSource: (source: "assets") => void
		renderSendButton?: () => ReactNode
	}) => (
		<>
			<button type="button" onClick={() => onSelectSource("assets")}>
				打开素材库
			</button>
			{renderSendButton?.()}
		</>
	),
}))

vi.mock("../../../../toolbar/AssetsModal", () => ({
	default: (props: AssetsModalHarnessProps) => {
		mocks.assetsModalProps = props
		return props.open ? (
			<div data-testid="assets-modal">
				<button type="button" onClick={props.onClose}>
					取消素材选择
				</button>
			</div>
		) : null
	},
}))
vi.mock("@/components/CanvasDesign/ui/toolbar/AssetsModal", () => ({
	default: (props: AssetsModalHarnessProps) => {
		mocks.assetsModalProps = props
		return props.open ? <div data-testid="assets-modal" /> : null
	},
}))

const imageAsset = {
	asset_id: "asset-image-1",
	asset_kind: "ASSET",
	asset_business_type: null,
	asset_media_type: "IMAGE",
	parent_id: null,
	name: "第一张",
	description: "",
	file_url: "https://example.test/first.png",
	compliance_status: "PASS",
	compliance_failed_reason: null,
	owner: { id: "owner-1", name: "Alice" },
	owner_uid: "owner-1",
	source: "PERSONAL",
	tags: [],
} as AssetItem

const secondImageAsset = {
	...imageAsset,
	asset_id: "asset-image-2",
	name: "第二张",
} as AssetItem

const imageElement = {
	id: "image-1",
	type: "image",
	activeContentId: "content-1",
	contents: [{ contentId: "content-1", src: "./images/current.png" }],
} as const

function createConfig(): ImageEditorConfig {
	return {
		prompt: "生成一张图片",
		selectedModelId: "image-model",
		currentReferenceFiles: ["./images/old.png"],
		protectedReferencePaths: [],
		referenceFileInfos: [
			{ path: "./images/old.png", src: "./images/old.png", fileName: "old.png" },
		],
		mentionBindings: [],
		matchableItems: [],
		isReferencePolicyReady: true,
		maxReferenceFiles: 3,
		isReferenceFileLimitReached: false,
		isUploading: false,
		selectedReferenceSlot: {
			slotIndex: 0,
			slotKey: "image-reference-0",
			path: "./images/old.png",
		},
		referenceResourceType: "image",
		fileInputAccept: "image/*",
		hasRestoredRef: { current: true },
		handlers: {
			setPrompt: vi.fn(),
			setPopoverOpen: vi.fn(),
			triggerFileSelect: vi.fn(),
			resetSelectedReferenceSlot: vi.fn(),
			replaceReferenceFileAt: vi.fn(),
			handlePromptReferencePathsChange: vi.fn(),
			syncReferenceFilesFromElement: vi.fn(),
			updateMentionBindings: vi.fn(),
		},
		fileInputRef: { current: null },
	} as unknown as ImageEditorConfig
}

function renderSurface(selectionPersistenceKey = "image-editor") {
	const config = createConfig()
	mocks.currentElement = imageElement
	return {
		config,
		...render(
			<ImageEditorSurface
				imageElement={imageElement as never}
				config={config}
				editorRef={createRef<MessageEditorRef>()}
				shouldShow={() => true}
				floatingId="image-editor"
				selectionPersistenceKey={selectionPersistenceKey}
				placeholder="请输入提示词"
				onSend={vi.fn()}
				isSending={false}
			/>,
		),
	}
}

describe("ImageEditorSurface asset library", () => {
	beforeEach(() => {
		mocks.assetImportMany.mockReset()
		mocks.assetsModalProps = null
		mocks.confirmAssets = [imageAsset, secondImageAsset]
		mocks.currentElement = imageElement
		mocks.resolveResourceReference.mockReset().mockReturnValue({
			status: "resolved",
			resourceKind: "workspace-file",
			rawReference: "",
			workspacePath: "",
			storagePath: "",
			identity: "workspace:reference",
			candidates: [],
			resolutionSource: "strict-path",
		})
	})

	it("opens an image-only multi-select modal and applies results in order", async () => {
		const imported = [
			{
				elementId: "source-1",
				connectionId: "connection-1",
				workspacePath: "./images/first.png",
				fileName: "first.png",
				mediaType: "image" as const,
				source: "downloaded" as const,
			},
			{
				elementId: "source-2",
				connectionId: "connection-2",
				workspacePath: "./images/second.png",
				fileName: "second.png",
				mediaType: "image" as const,
				source: "downloaded" as const,
			},
		]
		mocks.assetImportMany.mockResolvedValue(imported)
		const { config } = renderSurface()

		fireEvent.click(screen.getByRole("button", { name: "打开素材库" }))
		await screen.findByTestId("assets-modal")

		expect(mocks.assetsModalProps).toMatchObject({
			mediaTypes: ["IMAGE"],
			multiple: true,
			maxCount: 3,
		})
		await act(async () => {
			await mocks.assetsModalProps?.onConfirmMultiple?.(mocks.confirmAssets)
		})

		expect(mocks.assetImportMany).toHaveBeenCalledWith({
			assetIds: ["asset-image-1", "asset-image-2"],
			targetElementId: "image-1",
			targetKind: "image-generator",
			slot: { kind: "reference" },
			allowedMediaTypes: ["image"],
			isCurrent: expect.any(Function),
		})
		expect(config.handlers.replaceReferenceFileAt).toHaveBeenNthCalledWith(
			1,
			0,
			{ path: "./images/first.png", src: "./images/first.png", fileName: "first.png" },
			{ ensurePromptMention: true, retainReferenceSlot: true },
		)
		expect(config.handlers.replaceReferenceFileAt).toHaveBeenNthCalledWith(
			2,
			1,
			{ path: "./images/second.png", src: "./images/second.png", fileName: "second.png" },
			{ ensurePromptMention: true, retainReferenceSlot: false },
		)
	})

	it("does not import on cancel and keeps the modal open after a failed batch", async () => {
		const { config } = renderSurface()
		fireEvent.click(screen.getByRole("button", { name: "打开素材库" }))
		await screen.findByTestId("assets-modal")
		act(() => mocks.assetsModalProps?.onClose())
		expect(config.handlers.resetSelectedReferenceSlot).not.toHaveBeenCalled()
		expect(mocks.assetImportMany).not.toHaveBeenCalled()

		mocks.assetImportMany.mockRejectedValueOnce(new Error("download failed"))
		fireEvent.click(screen.getByRole("button", { name: "打开素材库" }))
		await screen.findByTestId("assets-modal")
		await expect(
			mocks.assetsModalProps?.onConfirmMultiple?.(mocks.confirmAssets),
		).rejects.toThrow("download failed")
		expect(screen.getByTestId("assets-modal")).toBeInTheDocument()
		expect(config.handlers.replaceReferenceFileAt).not.toHaveBeenCalled()
	})

	it("rejects a confirmation after the editor session changes", async () => {
		mocks.assetImportMany.mockResolvedValue([])
		const view = renderSurface("image-editor-session-1")
		fireEvent.click(screen.getByRole("button", { name: "打开素材库" }))
		await screen.findByTestId("assets-modal")
		const staleConfirm = mocks.assetsModalProps?.onConfirmMultiple

		view.rerender(
			<ImageEditorSurface
				imageElement={imageElement as never}
				config={{ ...view.config, selectedModelId: "changed-image-model" }}
				editorRef={createRef<MessageEditorRef>()}
				shouldShow={() => true}
				floatingId="image-editor"
				selectionPersistenceKey="image-editor-session-2"
				placeholder="请输入提示词"
				onSend={vi.fn()}
				isSending={false}
			/>,
		)

		await act(async () => {
			await expect(staleConfirm?.(mocks.confirmAssets)).rejects.toThrow("stale")
		})
		expect(mocks.assetImportMany).not.toHaveBeenCalled()
		expect(screen.queryByTestId("assets-modal")).not.toBeInTheDocument()
	})
})
