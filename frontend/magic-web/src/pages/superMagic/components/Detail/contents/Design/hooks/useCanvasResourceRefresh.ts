import { useEffect, useRef, type RefObject } from "react"
import type {
	CanvasDesignRef,
	CanvasResourceRefreshItem,
} from "@/components/CanvasDesign/public/props"
import type { Canvas } from "@/components/CanvasDesign/runtime/core/Canvas"
import {
	ElementTypeEnum,
	type AudioElement,
	type CanvasDocument,
	type ImageElement,
	type LayerElement,
	type VideoElement,
} from "@/components/CanvasDesign/runtime/document/types"
import {
	getActiveContent,
	getActiveImageContent,
} from "@/components/CanvasDesign/runtime/document/elementContent"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { SuperMagicFileChangeMessage } from "@/types/chat/intermediate_message"
import type { SeqResponse } from "@/types/request"
import type { DesignAttachmentIndex } from "../utils/designAttachmentIndex"
import { registerWaitForNextAttachmentsRefreshForProject } from "@/pages/superMagic/services/attachmentsTopicSync"
import { resolveDesignCanvasResourceReference } from "../utils/designResourceReferenceResolver"
import { normalizePathSeparators } from "@/components/CanvasDesign/runtime/shared/path/canvasResourcePath"

interface UseCanvasResourceRefreshOptions {
	canvasDesignRef: RefObject<CanvasDesignRef | null>
	canvas?: CanvasDocument
	flatAttachments?: FileItem[]
	attachmentsReady?: boolean
	attachmentIndex?: DesignAttachmentIndex | null
	designProjectBasePath?: string
	projectId?: string
	isNewestVersion: boolean
	isPlaybackMode: boolean
}

export function useCanvasResourceRefresh(options: UseCanvasResourceRefreshOptions): void {
	const {
		canvasDesignRef,
		canvas,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		designProjectBasePath,
		projectId,
		isNewestVersion,
		isPlaybackMode,
	} = options
	const resourceSnapshotRef = useRef<CanvasResourceSnapshotState | null>(null)

	useEffect(() => {
		const canvasInstance = canvasDesignRef.current?.getCanvasInstance() ?? undefined
		const nextSnapshot = buildCanvasResourceSnapshot({
			canvas,
			canvasInstance,
			flatAttachments,
			attachmentsReady,
			attachmentIndex,
			designProjectBasePath,
		})
		const previousSnapshot = resourceSnapshotRef.current

		if (!isNewestVersion || isPlaybackMode) {
			if (!previousSnapshot) resourceSnapshotRef.current = nextSnapshot
			return
		}

		resourceSnapshotRef.current = nextSnapshot
		if (!previousSnapshot) return

		const changedResources = getChangedCanvasResources(previousSnapshot, nextSnapshot)
		if (changedResources.length === 0) return

		void canvasDesignRef.current?.refreshResources(changedResources)
	}, [
		canvas,
		canvasDesignRef,
		designProjectBasePath,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		isNewestVersion,
		isPlaybackMode,
	])

	useEffect(() => {
		if (!projectId) return

		const handleFileChangeIntermediate = (seq: SeqResponse<SuperMagicFileChangeMessage>) => {
			const messageData = seq?.message
			if (!messageData || messageData.project_id !== projectId) return
			if (!Array.isArray(messageData.changes) || messageData.changes.length === 0) return
			if (!isNewestVersion || isPlaybackMode) return

			const snapshot = buildCanvasResourceSnapshot({
				canvas,
				canvasInstance: canvasDesignRef.current?.getCanvasInstance() ?? undefined,
				flatAttachments,
				attachmentsReady,
				attachmentIndex,
				designProjectBasePath,
			})
			resourceSnapshotRef.current = snapshot
			if (!snapshot.items.size) return

			const changedResources = getChangedCanvasResourcesFromFileChanges(
				messageData.changes,
				snapshot,
			)
			if (changedResources.length === 0) return

			void canvasDesignRef.current?.refreshResources(changedResources)
			void registerWaitForNextAttachmentsRefreshForProject(projectId, { timeoutMs: 15_000 })
				.catch(() => undefined)
				.then(() => {
					void canvasDesignRef.current?.refreshResources(changedResources)
				})
		}

		pubsub.subscribe(
			PubSubEvents.Super_Magic_File_Change_Intermediate,
			handleFileChangeIntermediate,
		)

		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Super_Magic_File_Change_Intermediate,
				handleFileChangeIntermediate,
			)
		}
	}, [
		canvas,
		canvasDesignRef,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		designProjectBasePath,
		isNewestVersion,
		isPlaybackMode,
		projectId,
	])
}

export function buildCanvasResourceSnapshot(params: {
	canvas?: CanvasDocument
	canvasInstance?: Canvas
	flatAttachments?: FileItem[]
	attachmentsReady?: boolean
	attachmentIndex?: DesignAttachmentIndex | null
	designProjectBasePath?: string
}): CanvasResourceSnapshotState {
	const {
		canvas,
		canvasInstance,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		designProjectBasePath,
	} = params
	const items = new Map<string, CanvasResourceSnapshot>()
	const itemsByReference = new Map<string, CanvasResourceSnapshot>()

	collectCanvasResourceSnapshots({
		elements: canvas?.elements,
		canvasInstance,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		designProjectBasePath,
		items,
		itemsByReference,
	})

	return {
		items,
		itemsByReference,
		resourcesByResolvedPath: buildResourcesByResolvedPathIndex(itemsByReference),
	}
}

function collectCanvasResourceSnapshots(params: {
	elements?: LayerElement[]
	canvasInstance?: Canvas
	flatAttachments?: FileItem[]
	attachmentsReady?: boolean
	attachmentIndex?: DesignAttachmentIndex | null
	designProjectBasePath?: string
	items: Map<string, CanvasResourceSnapshot>
	itemsByReference: Map<string, CanvasResourceSnapshot>
}): void {
	const {
		elements,
		canvasInstance,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		designProjectBasePath,
		items,
		itemsByReference,
	} = params
	if (!elements?.length) return

	for (const element of elements) {
		if (element.type === ElementTypeEnum.Image) {
			addCanvasResourceSnapshot({
				src:
					(
						canvasInstance?.getEffectiveContent(element.id) as
							| { src?: string }
							| undefined
					)?.src ?? getActiveImageContent(element as ImageElement).src,
				mediaType: "image",
				flatAttachments,
				attachmentsReady,
				attachmentIndex,
				designProjectBasePath,
				items,
				itemsByReference,
			})
		}

		if (element.type === ElementTypeEnum.Video) {
			addCanvasResourceSnapshot({
				src:
					(
						canvasInstance?.getEffectiveContent(element.id) as
							| { src?: string }
							| undefined
					)?.src ?? getActiveContent(element as VideoElement)?.src,
				mediaType: "video",
				flatAttachments,
				attachmentsReady,
				attachmentIndex,
				designProjectBasePath,
				items,
				itemsByReference,
			})
		}

		if (element.type === ElementTypeEnum.Audio) {
			addCanvasResourceSnapshot({
				src:
					(
						canvasInstance?.getEffectiveContent(element.id) as
							| { src?: string }
							| undefined
					)?.src ?? getActiveContent(element as AudioElement)?.src,
				mediaType: "audio",
				flatAttachments,
				attachmentsReady,
				attachmentIndex,
				designProjectBasePath,
				items,
				itemsByReference,
			})
		}

		if ("children" in element) {
			collectCanvasResourceSnapshots({
				elements: element.children,
				canvasInstance,
				flatAttachments,
				attachmentsReady,
				attachmentIndex,
				designProjectBasePath,
				items,
				itemsByReference,
			})
		}
	}
}

function addCanvasResourceSnapshot(params: {
	src?: string
	mediaType: CanvasResourceRefreshItem["mediaType"]
	flatAttachments?: FileItem[]
	attachmentsReady?: boolean
	attachmentIndex?: DesignAttachmentIndex | null
	designProjectBasePath?: string
	items: Map<string, CanvasResourceSnapshot>
	itemsByReference: Map<string, CanvasResourceSnapshot>
}): void {
	const {
		src,
		mediaType,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		designProjectBasePath,
		items,
		itemsByReference,
	} = params
	if (!src) return

	const resourcePath = normalizeCanvasResourcePath(src)
	if (!resourcePath) return

	const resolution = resolveDesignCanvasResourceReference(
		src,
		{
			flatAttachments,
			attachmentsReady,
			attachmentIndex,
			designProjectBasePath,
		},
		{ requireAttachment: true },
	)
	if (
		resolution.status === "resolved" &&
		(resolution.resourceKind === "external" || resolution.resourceKind === "opaque-asset")
	)
		return

	const resolvedPath =
		resolution.status === "resolved" && resolution.workspacePath
			? normalizeCanvasResourcePath(resolution.workspacePath)
			: resourcePath
	const identity =
		resolution.status === "resolved"
			? resolution.identity
			: `unresolved:${normalizePathSeparators(src.trim())}`
	const attachmentId = resolution.status === "resolved" ? resolution.attachmentId : undefined
	const attachment = attachmentId
		? (attachmentIndex?.byFileId.get(attachmentId) ??
			flatAttachments?.find((item) => item.file_id === attachmentId))
		: undefined
	const identityKey = `${mediaType}\0${identity}`
	const referenceKey = `${mediaType}\0${normalizePathSeparators(src.trim())}`
	const signature = [
		resolution.status,
		identity,
		resolvedPath,
		attachmentId ?? "",
		attachment?.updated_at ?? "",
		attachment?.file_size ?? "",
	].join("\0")

	const snapshot = {
		path: src,
		resolvedPath,
		mediaType,
		signature,
	}
	items.set(identityKey, snapshot)
	itemsByReference.set(referenceKey, snapshot)
}

export function getChangedCanvasResources(
	previousSnapshot: CanvasResourceSnapshotState,
	nextSnapshot: CanvasResourceSnapshotState,
): CanvasResourceRefreshItem[] {
	const changedMap = new Map<string, CanvasResourceRefreshItem>()

	nextSnapshot.itemsByReference.forEach((nextItem, key) => {
		const previousItem = previousSnapshot.itemsByReference.get(key)
		if (!previousItem) return
		if (previousItem.signature === nextItem.signature) return

		changedMap.set(`${nextItem.mediaType}\0${nextItem.path}`, {
			path: nextItem.path,
			mediaType: nextItem.mediaType,
		})
	})

	return Array.from(changedMap.values())
}

export function getChangedCanvasResourcesFromFileChanges(
	changes: SuperMagicFileChangeMessage["changes"],
	snapshot: CanvasResourceSnapshotState,
): CanvasResourceRefreshItem[] {
	const changedMap = new Map<string, CanvasResourceRefreshItem>()

	for (const change of changes) {
		const changedPath = normalizeCanvasResourcePath(change.file?.relative_file_path || "")
		if (!changedPath || !isDesignMediaResourcePath(changedPath)) continue

		const resources = snapshot.resourcesByResolvedPath.get(changedPath)
		if (!resources?.length) continue
		resources.forEach((resource) => {
			changedMap.set(`${resource.mediaType}\0${resource.path}`, {
				path: resource.path,
				mediaType: resource.mediaType,
			})
		})
	}

	return Array.from(changedMap.values())
}

function buildResourcesByResolvedPathIndex(
	snapshot: Map<string, CanvasResourceSnapshot>,
): Map<string, CanvasResourceSnapshot[]> {
	const index = new Map<string, CanvasResourceSnapshot[]>()
	snapshot.forEach((resource) => {
		const resources = index.get(resource.resolvedPath)
		if (resources) {
			resources.push(resource)
			return
		}
		index.set(resource.resolvedPath, [resource])
	})
	return index
}

function normalizeCanvasResourcePath(path?: string): string {
	if (!path) return ""
	return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
}

function isDesignMediaResourcePath(path: string): boolean {
	const parts = normalizeCanvasResourcePath(path).split("/")
	return parts.includes("images") || parts.includes("videos") || parts.includes("audios")
}

export interface CanvasResourceSnapshot extends CanvasResourceRefreshItem {
	resolvedPath: string
	signature: string
}

export interface CanvasResourceSnapshotState {
	items: Map<string, CanvasResourceSnapshot>
	itemsByReference: Map<string, CanvasResourceSnapshot>
	resourcesByResolvedPath: Map<string, CanvasResourceSnapshot[]>
}
