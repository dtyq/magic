import type {
	AttachmentDragData,
	MultipleFilesDragData,
	PPTSlideDragData,
	TabDragData,
} from "@/pages/superMagic/components/MessageEditor/utils/drag"

/**
 * 文件预览激活时同步当前选中文件 ID 到其他组件。
 * 传入被激活的文件 ID。
 */
export type SuperMagicUpdateActiveFileIdArgs = [fileId: string]

/**
 * 触发左侧文件树将指定文件滚动到可见区域并高亮。
 * 传入目标文件 ID。
 */
export type SuperMagicLocateFileInTreeArgs = [fileId: string]

/**
 * 请求刷新当前话题的附件列表。
 * 可选附带刷新完成后的回调函数。
 */
export type SuperMagicUpdateAttachmentsArgs = [callback?: () => void]

/**
 * 附件列表加载状态变更时通知相关组件。
 * 传入 loading 布尔值：true 表示加载中，false 表示加载完成。
 */
export type SuperMagicUpdateAttachmentsLoadingArgs = [loading: boolean]

/**
 * 切换文件预览的历史版本。
 * 传入文件 ID 和目标版本号（版本号可选，缺省时展示最新版本）。
 */
export type SuperMagicChangePreviewFileVersionArgs = [fileId: string, fileVersion?: string]

/**
 * 让文件详情区进入编辑状态。
 * 传入目标文件 ID。
 */
export type SuperMagicEnterEditModeArgs = [fileId: string]

/**
 * 外部（原生层）将拖拽数据投入消息编辑器时发布。
 * 当前允许的 payload 与编辑器拖拽协议保持一致，消费方可直接按 type 分派。
 *
 * 示例：
 * pubsub.publish(PubSubEvents.Insert_Drag_Data_To_Editor, {
 *   type: DRAG_TYPE.ProjectFile,
 *   data: fileItem,
 * })
 */
export type SuperMagicInsertDragDataToEditorPayload =
	| TabDragData
	| AttachmentDragData
	| MultipleFilesDragData
	| PPTSlideDragData

export type SuperMagicInsertDragDataToEditorArgs = [
	dragData: SuperMagicInsertDragDataToEditorPayload,
]
