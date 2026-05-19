/**
 * dragenter/dragover 阶段 DataTransfer#getData 多为空串，无法解析项目附件 JSON。
 * 在附件列表 dragstart 写入与 dragend 清除，供参考图拖放层在悬停时解析路径与后缀。
 */
let activePlainTextPayload: string | null = null

export function setProjectAttachmentDragHoverPlainText(payload: string): void {
	activePlainTextPayload = payload
}

export function clearProjectAttachmentDragHoverPlainText(): void {
	activePlainTextPayload = null
}

export function peekProjectAttachmentDragHoverPlainText(): string | null {
	return activePlainTextPayload
}
