import { act, render, screen } from "@testing-library/react"
import { createRef, type ForwardedRef, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ImageEditorConfig } from "../useImageEditorConfig"
import type { MessageEditorRef } from "../../../../editors/message/MessageEditor"
import ImageEditorSurface, { hasDeletedReference } from "../ImageEditorSurface"

type Availability = "available" | "deleted" | "pending" | "unknown"

const mocks = vi.hoisted(() => ({
	availabilityByPath: new Map<string, Availability>(),
	pendingPaths: new Set<string>(),
	activeMediaReferences: [] as Array<{ kind: "image"; path: string }>,
	pendingChangeHandler: null as null | ((event: { data: { paths: string[] } }) => void),
	resolveResourceReference: vi.fn(),
	setEditingElementId: vi.fn(),
}))

// The focused surface suite never exercises the asset dialog's API calls.
vi.mock("@/apis", () => ({ AssetsApi: {} }))

const getResolution = (path: string) => {
	switch (mocks.availabilityByPath.get(path)) {
		case "available":
			return {
				status: "resolved" as const,
				resourceKind: "workspace-file" as const,
				rawReference: path,
				workspacePath: path,
				storagePath: path,
				identity: `workspace:${path}`,
				candidates: [path],
				legacyRecovered: false,
				resolutionSource: "strict-path" as const,
			}
		case "deleted":
			return { status: "not-found" as const, rawReference: path, candidates: [path] }
		case "pending":
			return {
				status: "attachments-pending" as const,
				rawReference: path,
				candidates: [path],
			}
		default:
			return {
				status: "ambiguous" as const,
				rawReference: path,
				candidates: [path],
				attachmentIds: [],
			}
	}
}

const canvas = {
	magicConfigManager: {
		config: { methods: { resolveResourceReference: mocks.resolveResourceReference } },
	},
	canvasFileUploadManager: {
		isPendingResourcePath: (path: string | undefined) =>
			Boolean(path && mocks.pendingPaths.has(path)),
	},
	eventEmitter: {
		on: (event: string, handler: (event: { data: { paths: string[] } }) => void) => {
			if (event === "upload:resource-pending-change") mocks.pendingChangeHandler = handler
			return vi.fn()
		},
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
			useImperativeHandle(ref, () => ({ hasPendingUploadMentions: () => false }))
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
			activeMediaReferences: mocks.activeMediaReferences,
			textPrompt: "",
			textConnections: [],
			mediaItems: [],
		},
		handleMentionChange: vi.fn(() => true),
		handleLinkedMediaSelectionChange: vi.fn(),
	}),
}))

vi.mock("../ImageEditorControls", () => ({
	default: ({ renderSendButton }: { renderSendButton?: () => ReactNode }) => renderSendButton?.(),
}))

// The real library dialog pulls the enterprise admin alias into this focused
// surface test; keep the test scoped to deleted-reference submit behavior.
vi.mock("../../../../toolbar/AssetsModal", () => ({
	default: () => null,
}))
vi.mock("@/components/CanvasDesign/ui/toolbar/AssetsModal", () => ({
	default: () => null,
}))

const imageElement = {
	id: "image-1",
	type: "image",
	activeContentId: "content-1",
	contents: [{ contentId: "content-1", src: "/images/current.png" }],
} as never

function createConfig(currentReferenceFiles: string[]): ImageEditorConfig {
	return {
		prompt: "生成一张图片",
		selectedModelId: "image-model",
		currentReferenceFiles,
		protectedReferencePaths: [],
		referenceFileInfos: currentReferenceFiles.map((path) => ({
			path,
			src: path,
			fileName: path,
			assetType: "image" as const,
		})),
		mentionBindings: [],
		matchableItems: [],
		isReferencePolicyReady: true,
		maxReferenceFiles: 8,
		isReferenceFileLimitReached: false,
		isUploading: false,
		selectedReferenceSlot: null,
		referenceResourceType: "image",
		fileInputAccept: "image/*",
		hasRestoredRef: { current: true },
		handlers: {
			setPrompt: vi.fn(),
			setPopoverOpen: vi.fn(),
			handlePromptReferencePathsChange: vi.fn(),
			syncReferenceFilesFromElement: vi.fn(),
			updateMentionBindings: vi.fn(),
		},
		fileInputRef: { current: null },
	} as unknown as ImageEditorConfig
}

function renderSurface(config: ImageEditorConfig) {
	return render(
		<ImageEditorSurface
			imageElement={imageElement}
			config={config}
			editorRef={createRef<MessageEditorRef>()}
			shouldShow={() => true}
			floatingId="image-editor"
			selectionPersistenceKey="image-editor"
			placeholder="请输入提示词"
			onSend={vi.fn()}
			isSending={false}
		/>,
	)
}

describe("ImageEditorSurface deleted references", () => {
	beforeEach(() => {
		mocks.availabilityByPath.clear()
		mocks.pendingPaths.clear()
		mocks.activeMediaReferences = []
		mocks.pendingChangeHandler = null
		mocks.resolveResourceReference.mockImplementation((input: { path?: string }) =>
			getResolution(input.path ?? ""),
		)
	})

	it.each(["available", "pending", "unknown"] as const)(
		"keeps submit enabled for %s references",
		(availability) => {
			mocks.availabilityByPath.set("/images/reference.png", availability)
			renderSurface(createConfig(["/images/reference.png"]))

			expect(screen.getByRole("button")).toBeEnabled()
		},
	)

	it("disables submit for a deleted manual reference", () => {
		mocks.availabilityByPath.set("/images/deleted.png", "deleted")
		renderSurface(createConfig(["/images/deleted.png"]))

		expect(screen.getByRole("button")).toBeDisabled()
	})

	it("disables submit when quick edit adds the deleted current image as a reference", () => {
		mocks.availabilityByPath.set("/images/current.png", "deleted")
		renderSurface(createConfig(["/images/current.png"]))

		expect(screen.getByRole("button")).toBeDisabled()
	})

	it("disables submit for a deleted active linked image", () => {
		mocks.availabilityByPath.set("/images/linked.png", "deleted")
		mocks.activeMediaReferences = [{ kind: "image", path: "/images/linked.png" }]
		renderSurface(createConfig([]))

		expect(screen.getByRole("button")).toBeDisabled()
	})

	it("restores submit after the deleted reference is removed or replaced", () => {
		mocks.availabilityByPath.set("/images/deleted.png", "deleted")
		mocks.availabilityByPath.set("/images/replacement.png", "available")
		const view = renderSurface(createConfig(["/images/deleted.png"]))
		expect(screen.getByRole("button")).toBeDisabled()

		view.rerender(
			<ImageEditorSurface
				imageElement={imageElement}
				config={createConfig([])}
				editorRef={createRef<MessageEditorRef>()}
				shouldShow={() => true}
				floatingId="image-editor"
				selectionPersistenceKey="image-editor"
				placeholder="请输入提示词"
				onSend={vi.fn()}
				isSending={false}
			/>,
		)
		expect(screen.getByRole("button")).toBeEnabled()

		view.rerender(
			<ImageEditorSurface
				imageElement={imageElement}
				config={createConfig(["/images/replacement.png"])}
				editorRef={createRef<MessageEditorRef>()}
				shouldShow={() => true}
				floatingId="image-editor"
				selectionPersistenceKey="image-editor"
				placeholder="请输入提示词"
				onSend={vi.fn()}
				isSending={false}
			/>,
		)
		expect(screen.getByRole("button")).toBeEnabled()
	})

	it("does not block a deleted main image unless it is a reference", () => {
		mocks.availabilityByPath.set("/images/current.png", "deleted")
		renderSurface(createConfig([]))

		expect(screen.getByRole("button")).toBeEnabled()
	})

	it("keeps pending uploads enabled and recomputes when the pending window closes", () => {
		const path = "/images/uploading.png"
		mocks.availabilityByPath.set(path, "deleted")
		mocks.pendingPaths.add(path)
		renderSurface(createConfig([path]))
		expect(screen.getByRole("button")).toBeEnabled()

		mocks.pendingPaths.delete(path)
		act(() => mocks.pendingChangeHandler?.({ data: { paths: [path] } }))

		expect(screen.getByRole("button")).toBeDisabled()
	})
})

describe("hasDeletedReference", () => {
	it("fails open when no resolver is available", () => {
		expect(hasDeletedReference(["/images/reference.png"], canvas as never)).toBe(false)
	})
})
