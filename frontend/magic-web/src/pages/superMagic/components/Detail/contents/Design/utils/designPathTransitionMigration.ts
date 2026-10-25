import type { LayerElement } from "@/components/CanvasDesign/runtime/document/types"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { DesignData } from "../types"
import type { DesignAttachmentIndex } from "./designAttachmentIndex"
import { rewriteLayerElementsToDesignDslPaths } from "./designPath"
import { resolveDesignCanvasResourceReference } from "./designResourceReferenceResolver"

export interface DesignPathTransitionMigrationContext {
	designProjectBasePath?: string
	flatAttachments?: FileItem[]
	attachmentsReady?: boolean
	attachmentIndex?: DesignAttachmentIndex | null
}

/**
 * 过渡期历史裸路径修复。
 *
 * `images/a.png` 在旧 DSL 中可能表示当前画布资源，也可能表示工作区根资源。
 * 附件树唯一确认当前画布资源时收口为 `./images/a.png`；唯一确认工作区根资源时
 * 收口为 `/images/a.png`。附件缺失或多候选歧义时原样保留，避免猜错归属。
 *
 * 这是历史数据平滑迁移逻辑。所有新建资源仍应直接产出显式 `./images|videos|audios/...`。
 */
export function normalizeDesignPathForTransitionMigration(
	path: string,
	context: DesignPathTransitionMigrationContext,
): string {
	const designProjectBasePath = context.designProjectBasePath?.trim()
	if (!designProjectBasePath) return path

	const resolution = resolveDesignCanvasResourceReference(path, {
		designProjectBasePath,
		flatAttachments: context.flatAttachments,
		attachmentsReady: context.attachmentsReady,
		attachmentIndex: context.attachmentIndex,
	})
	return resolution.status === "resolved" ? resolution.storagePath : path
}

export function rewriteDesignLayerPathsForTransitionMigration(
	elements: LayerElement[] | undefined,
	context: DesignPathTransitionMigrationContext,
): void {
	const designProjectBasePath = context.designProjectBasePath?.trim()
	if (!elements?.length || !designProjectBasePath) return

	rewriteLayerElementsToDesignDslPaths(elements, designProjectBasePath, {
		rewritePath: (path) => normalizeDesignPathForTransitionMigration(path, context),
	})
}

export function migrateLoadedDesignDataPaths(
	designData: DesignData,
	context: DesignPathTransitionMigrationContext,
): void {
	rewriteDesignLayerPathsForTransitionMigration(designData.canvas?.elements, context)
}
