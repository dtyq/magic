import {
	DetailType,
	type DetailOperationResultListData,
	type OperationResultItem,
	type OperationResultTarget,
	type OperationResultCanvasTarget,
	type OperationResultFileTarget,
	type OperationResultUrlTarget,
	type OperationResultSummary,
} from "../components/Detail/types"

const CANVAS_GENERATION_TOOL_NAMES = new Set([
	"add_canvas_elements",
	"add_canvas_contents",
	"generate_canvas_images",
	"generate_images_to_canvas",
])

/** 展示位置由类型决定；即使数据损坏，也在原卡片说明，不切换到回放面板。 */
export function isInlineToolDetail(detail: unknown): boolean {
	return isRecord(detail) && detail.type === DetailType.OperationResultList
}

export function getOperationResultListData(
	detail: unknown,
): DetailOperationResultListData | undefined {
	if (!isRecord(detail) || !isRecord(detail.data)) return
	if (detail.type === DetailType.Search && Array.isArray(detail.data.groups)) {
		const items: OperationResultItem[] = []
		let count = 0
		for (const group of detail.data.groups) {
			if (!isRecord(group) || !Array.isArray(group.results)) continue
			for (const result of group.results) {
				if (!isRecord(result) || !isHttpUrl(result.url)) continue
				count += 1
				if (items.length >= 8) continue
				items.push({
					label: getString(result.title) || new URL(result.url).hostname,
					kind: "text",
					status: "success",
					message: "",
					target: { type: "url", url: result.url },
				})
			}
		}
		return items.length
			? {
					items: items.slice(0, 8),
					stage: "find",
					total_count: count,
					success_count: count,
					omitted_count: Math.max(0, count - 8),
				}
			: undefined
	}
	if (!isInlineToolDetail(detail)) return
	const data = detail.data
	const { items } = data
	if (!Array.isArray(items) || items.length === 0 || !items.every(isOperationResultItem)) return
	return {
		...detail.data,
		stage: ["read", "edit", "find", "download", "analyze", "load"].includes(
			String(detail.data.stage),
		)
			? (detail.data.stage as OperationResultSummary["stage"])
			: undefined,
		...Object.fromEntries(
			["total_count", "success_count", "failed_count", "skipped_count", "omitted_count"].map(
				(key) => [
					key,
					typeof data[key] === "number" && Number.isInteger(data[key]) && data[key] >= 0
						? data[key]
						: undefined,
				],
			),
		),
		items: items.map((item) => ({
			...item,
			started_at: item.started_at ?? undefined,
			expected_finished_at: item.expected_finished_at ?? undefined,
			target: isCanvasElementTarget(item.target)
				? {
						...item.target,
						content_id: item.target.content_id ?? undefined,
						content_type: item.target.content_type ?? undefined,
					}
				: isFileTarget(item.target) || isUrlTarget(item.target)
					? item.target
					: undefined,
		})),
	}
}

/** 列表仍留在消息里；报告正文或持久化 file_id 通过原 Markdown 入口打开。 */
export function getOperationResultListReportDetail(
	detail: unknown,
): { type: DetailType; data: Record<string, unknown> } | undefined {
	if (!isRecord(detail) || !isRecord(detail.data)) return
	if (detail.type === DetailType.Search) return { type: DetailType.Search, data: detail.data }
	if (!isInlineToolDetail(detail)) return
	const data = detail.data
	if (
		!getString(data.file_name) ||
		(!getString(data.content) && !getString(data.file_id) && !getString(data.target_file_path))
	)
		return
	// 只改变本次展示目标，不改写消息里的清单、正文或文件引用。
	const reportData = { ...data }
	delete reportData.items
	return {
		type:
			Object.values(DetailType).includes(data.report_type as DetailType) &&
			data.report_type !== DetailType.OperationResultList
				? (data.report_type as DetailType)
				: DetailType.Md,
		data: reportData,
	}
}

/**
 * 从工具调用参数构建进行中的 Canvas 结果占位。
 * 后端最终 detail 到达前仍可展示名称；只有参数明确提供 element_id 时才允许定位。
 */
export function getPendingCanvasOperationResultDetail(
	toolName: string | undefined,
	rawArguments: string | undefined,
): Record<string, unknown> | undefined {
	if (!toolName || !CANVAS_GENERATION_TOOL_NAMES.has(toolName) || !rawArguments) return undefined

	const argumentsData = parseRecord(rawArguments)
	if (!argumentsData) return undefined

	const projectPath = getString(argumentsData.project_path)
	const rawItems = Array.isArray(argumentsData.items)
		? argumentsData.items
		: Array.isArray(argumentsData.tasks)
			? argumentsData.tasks
			: []
	const items: OperationResultItem[] = []

	for (const rawItem of rawItems) {
		if (!isRecord(rawItem)) continue
		const content = isRecord(rawItem.content) ? rawItem.content : undefined
		const itemRef = getString(rawItem.item_ref)
		const label =
			getString(content?.name) ||
			getString(rawItem.name) ||
			itemRef ||
			getString(rawItem.element_id) ||
			getString(rawItem.output_image_element_id)
		if (!label) continue

		const elementId =
			getString(rawItem.element_id) || getString(rawItem.output_image_element_id)
		const contentType = getString(content?.content_type)
		const target: OperationResultTarget | undefined =
			projectPath && elementId
				? {
						type: "canvas_element" as const,
						project_path: projectPath,
						element_id: elementId,
						content_id: getString(rawItem.content_id) || getString(content?.content_id),
						content_type:
							contentType === "image" ||
							contentType === "video" ||
							contentType === "audio"
								? contentType
								: Array.isArray(argumentsData.tasks)
									? "image"
									: undefined,
					}
				: undefined
		items.push({
			label,
			kind: "text",
			status: "success",
			message: "",
			target,
		})
	}

	if (items.length === 0) return undefined
	return {
		type: DetailType.OperationResultList,
		data: { items },
	}
}

function isOperationResultItem(
	item: unknown,
): item is Omit<OperationResultItem, "target"> & { target?: unknown } {
	return (
		isRecord(item) &&
		typeof item.label === "string" &&
		(item.kind === "file" || item.kind === "directory" || item.kind === "text") &&
		(item.status === "success" || item.status === "error" || item.status === "skipped") &&
		typeof item.message === "string" &&
		(item.description === undefined || typeof item.description === "string") &&
		(item.changes == null ||
			(isRecord(item.changes) &&
				[
					item.changes.added_lines,
					item.changes.deleted_lines,
					item.changes.modified_lines ?? 0,
				].every(
					(value) => typeof value === "number" && Number.isInteger(value) && value >= 0,
				))) &&
		(item.started_at == null || typeof item.started_at === "string") &&
		(item.expected_finished_at == null || typeof item.expected_finished_at === "string") &&
		(item.is_processing == null || typeof item.is_processing === "boolean")
	)
}

function isCanvasElementTarget(value: unknown): value is OperationResultCanvasTarget {
	return (
		isRecord(value) &&
		value.type === "canvas_element" &&
		typeof value.project_path === "string" &&
		value.project_path.length > 0 &&
		typeof value.element_id === "string" &&
		value.element_id.length > 0 &&
		(value.content_id == null ||
			(typeof value.content_id === "string" && value.content_id.length > 0)) &&
		(value.content_type == null ||
			value.content_type === "image" ||
			value.content_type === "video" ||
			value.content_type === "audio")
	)
}

function isFileTarget(value: unknown): value is OperationResultFileTarget {
	if (!isRecord(value) || value.type !== "file" || typeof value.relative_file_path !== "string")
		return false
	const path = value.relative_file_path
	// 文件目标只接受当前项目的相对路径，不能转成 URL、个人文件或其他项目引用。
	return (
		Boolean(path) &&
		!path.startsWith("/") &&
		path.split("/").every((part) => part && part !== "." && part !== "..")
	)
}

function isHttpUrl(value: unknown): value is string {
	if (typeof value !== "string") return false
	try {
		return ["https:", "http:"].includes(new URL(value).protocol)
	} catch {
		return false
	}
}

function isUrlTarget(value: unknown): value is OperationResultUrlTarget {
	return isRecord(value) && value.type === "url" && isHttpUrl(value.url)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value)
}

function parseRecord(value: string): Record<string, unknown> | undefined {
	try {
		const parsed: unknown = JSON.parse(value)
		return isRecord(parsed) ? parsed : undefined
	} catch {
		return undefined
	}
}

function getString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined
}
