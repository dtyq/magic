import { CanvasDocument } from "@/components/CanvasDesign/runtime/document/types"

export interface DesignData {
	type: "design" | string
	/** 设计目录名 */
	name: string
	/**
	 * 信封 version，作为 magic.project.js 格式契约：
	 * - "1.0.0"（v1）：canvas 明文对象、重字段内联
	 * - "2.0.0"（v2）：canvas 压缩串、重字段拆到 element-details sidecar
	 * - "3.0.0"（v3）：canvas 压缩串、统一 Content 结构、Content 级 sidecar
	 * 加载层负责将已发布旧格式升级为 v3；保存始终输出 v3。
	 */
	version: string
	canvas?: CanvasDocument
}
