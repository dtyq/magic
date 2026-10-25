import { useLayoutEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import i18next from "i18next"
import { formatFileSize } from "@/utils/string"
import { normalizeLocale } from "@/utils/locale"
import { sourceLabelKey } from "../components/FileInfoPanel/utils"
import type { FileManagerSort } from "../components/FileManager/types"
import type { FilePresentation } from "../utils/file-presentation"
import type { FileManagerColumnsSnapshot } from "@/models/config/repositories/SuperProjectStateTypes"

interface ColumnDefinition {
	id: FileManagerSort
	width: number
	min: number
}

interface Options {
	defaultNameWidth?: number
}

const columns: ColumnDefinition[] = [
	{ id: "name", width: 260, min: 160 },
	{ id: "size", width: 90, min: 72 },
	{ id: "type", width: 110, min: 84 },
	{ id: "modified", width: 205, min: 160 },
	{ id: "created", width: 205, min: 160 },
	{ id: "source", width: 110, min: 84 },
	{ id: "path", width: 260, min: 140 },
]

/** 列宽只属于当前管理器。指针移动只更新共同 CSS，结束时再提交小型 React 状态。 */
export function useFileManagerColumns(saved?: FileManagerColumnsSnapshot, options?: Options) {
	const { t } = useTranslation("super")
	const containerRef = useRef<HTMLDivElement>(null)
	const [visibleIds, setVisibleIds] = useState<FileManagerSort[]>(() =>
		saved?.visibleIds
			? columns
					.filter(
						(column) => column.id === "name" || saved.visibleIds?.includes(column.id),
					)
					.map((column) => column.id)
			: ["name", "size", "type", "modified"],
	)
	const [widths, setWidths] = useState<Partial<Record<FileManagerSort, number>>>(() =>
		Object.fromEntries(
			columns.flatMap((column) => {
				const value = saved?.widths?.[column.id]
				return typeof value === "number" && Number.isFinite(value)
					? [[column.id, Math.max(column.min, Math.min(1200, Math.round(value)))]]
					: []
			}),
		),
	)
	const labels: Record<FileManagerSort, string> = {
		name: t("fileManager.name"),
		size: t("fileManager.columns.size"),
		type: t("fileManager.type"),
		modified: t("fileManager.modified"),
		created: t("fileManager.columns.created"),
		source: t("fileManager.columns.source"),
		path: t("fileManager.columns.path"),
	}
	const visible = columns.filter((column) => visibleIds.includes(column.id))
	const applyWidths = useMemoizedFn((values: typeof widths) => {
		const container = containerRef.current
		if (!container) return
		container.style.setProperty(
			"--manager-columns",
			visible
				.map((column) =>
					column.id === "name" && values.name === undefined
						? options?.defaultNameWidth === undefined
							? `minmax(${column.width}px, 1fr)`
							: `${options.defaultNameWidth}px`
						: `${values[column.id] ?? column.width}px`,
				)
				.join(" "),
		)
		// 包含行内边距及虚拟列表左右留白，表头和行共享同一水平滚动空间。
		container.style.setProperty(
			"--manager-list-width",
			`${visible.reduce((sum, column) => sum + (values[column.id] ?? (column.id === "name" ? options?.defaultNameWidth : undefined) ?? column.width), 44)}px`,
		)
	})
	useLayoutEffect(
		() => applyWidths(widths),
		[widths, visibleIds, options?.defaultNameWidth, applyWidths],
	)
	const clampWidth = (id: FileManagerSort, width: number) => {
		const column = columns.find((entry) => entry.id === id)
		if (!column) throw new Error(`Unknown file manager column: ${id}`)
		return Math.max(column.min, Math.min(1200, Math.round(width)))
	}
	const setWidth = useMemoizedFn((id: FileManagerSort, width: number) => {
		if (!Number.isFinite(width)) return
		setWidths((previous) => ({ ...previous, [id]: clampWidth(id, width) }))
	})
	const previewWidth = useMemoizedFn((id: FileManagerSort, width: number) =>
		applyWidths({ ...widths, [id]: clampWidth(id, width) }),
	)
	const cancelPreview = useMemoizedFn(() => applyWidths(widths))
	const toggle = useMemoizedFn((id: FileManagerSort) => {
		if (id === "name") return
		setVisibleIds((current) =>
			columns
				.filter((column) =>
					column.id === id ? !current.includes(id) : current.includes(column.id),
				)
				.map((column) => column.id),
		)
	})
	return {
		containerRef,
		columns,
		visible,
		visibleIds,
		widths,
		labels,
		setWidth,
		previewWidth,
		cancelPreview,
		clampWidth,
		toggle,
	}
}

/**
 * 选择器名称列按当前目录的常见名称长度估算：取 80 分位，避免少数超长名称把常用列撑开。
 * 220—280px 保留缩进、复选框、图标和文件标签的空间；超长名称继续由 SmartTooltip 展示完整内容。
 */
export function getCompactNameColumnWidth(names: readonly string[]): number {
	const lengths = names
		.map((name) => [...name.trim()].length)
		.filter((length) => length > 0)
		.sort((a, b) => a - b)
	const typicalLength = lengths[Math.floor(Math.max(0, lengths.length - 1) * 0.8)] ?? 8
	return Math.max(220, Math.min(280, 136 + typicalLength * 11))
}

export function getFileManagerColumnValue(
	file: FilePresentation,
	column: FileManagerSort,
): string | number | null {
	const item = file.item
	switch (column) {
		case "name":
			return file.name
		case "size": {
			const value: unknown = item.file_size
			if (
				file.isDirectory ||
				value === undefined ||
				value === null ||
				(typeof value === "string" && !value.trim())
			)
				return null
			const size = Number(value)
			return Number.isFinite(size) && size >= 0 ? size : null
		}
		case "modified":
			return parseFileTime(item.updated_at)
		case "created":
			return parseFileTime(item.created_at)
		case "type":
			return file.isDirectory
				? i18next.t("userSpace.folder", { ns: "super" })
				: item.file_extension?.toUpperCase() || i18next.t("userSpace.file", { ns: "super" })
		case "source":
			// 来源映射沿用详情页的闭集规则，缺失字段不推断为上传。
			return item.source == null
				? null
				: i18next.t(sourceLabelKey(item.source), { ns: "super" })
		case "path": {
			const path = item.relative_file_path?.replace(/\/+$/, "")
			if (!path) return null
			return path.slice(0, Math.max(0, path.lastIndexOf("/"))) || "/"
		}
	}
}

export function getFileManagerColumnText(
	file: FilePresentation,
	column: FileManagerSort,
	locale: string,
	rootName: string,
): string {
	const value = getFileManagerColumnValue(file, column)
	if (value === null) return "—"
	if (column === "size") return formatFileSize(Number(value))
	if (column === "modified" || column === "created")
		return formatDirectoryFileTime(Number(value), locale)
	if (column === "path" && value === "/") return rootName
	return String(value)
}

export function parseFileTime(value: unknown): number | null {
	if ((typeof value !== "number" && typeof value !== "string") || value === "") return null
	const numeric = typeof value === "number" || /^\d+$/.test(value) ? Number(value) : null
	const source =
		numeric !== null
			? numeric < 1e12
				? numeric * 1000
				: numeric
			: /(?:Z|[+-]\d{2}:?\d{2})$/i.test(String(value))
				? String(value)
				: String(value).replace(" ", "T") + "Z"
	const timestamp = new Date(source).getTime()
	return Number.isNaN(timestamp) ? null : timestamp
}

/** 明确按当前界面时区展示；无时区的服务端时间按 UTC 解析。 */
function formatDirectoryFileTime(timestamp: number, locale: string): string {
	// 项目语言键使用 zh_CN；浏览器 Intl 需要 zh-CN 格式。
	return new Intl.DateTimeFormat(normalizeLocale(locale).replaceAll("_", "-"), {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		timeZoneName: "short",
	}).format(new Date(timestamp))
}
