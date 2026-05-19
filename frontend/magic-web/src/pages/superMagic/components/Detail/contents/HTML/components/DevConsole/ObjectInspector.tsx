/**
 * ObjectInspector
 *
 * Renders a SerializedValue as an interactive, expandable tree — similar
 * to the browser DevTools object inspector.
 */

import { useState, useCallback } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SerializedValue } from "./types"

// ─── Value coloring by type ──────────────────────────────────────────────────

function getValueColor(type: SerializedValue["type"]): string {
	switch (type) {
		case "string":
			return "text-red-500 dark:text-red-400"
		case "number":
		case "bigint":
			return "text-blue-600 dark:text-blue-400"
		case "boolean":
			return "text-purple-600 dark:text-purple-400"
		case "null":
		case "undefined":
			return "text-gray-400"
		case "function":
			return "italic text-sky-500"
		case "date":
		case "regexp":
			return "text-green-600 dark:text-green-400"
		case "symbol":
			return "text-orange-500"
		case "error":
			return "text-red-600 dark:text-red-400"
		default:
			return "text-foreground"
	}
}

// ─── Inline preview for collapsed objects ────────────────────────────────────

function InlinePreview({ value }: { value: SerializedValue }) {
	const color = getValueColor(value.type)

	// Primitives: show value directly
	if (
		value.type === "string" ||
		value.type === "number" ||
		value.type === "boolean" ||
		value.type === "bigint" ||
		value.type === "null" ||
		value.type === "undefined" ||
		value.type === "symbol"
	) {
		return <span className={cn("font-mono", color)}>{value.preview}</span>
	}

	// Non-expandable types
	if (
		value.type === "function" ||
		value.type === "date" ||
		value.type === "regexp" ||
		value.type === "promise" ||
		value.type === "htmlelement"
	) {
		return <span className={cn("font-mono", color)}>{value.preview}</span>
	}

	// Objects / arrays / maps / sets / errors — show short preview
	return <span className="font-mono text-foreground">{value.preview}</span>
}

// ─── Single property row ─────────────────────────────────────────────────────

interface PropertyNodeProps {
	name: string
	value: SerializedValue
	depth: number
}

function PropertyNode({ name, value, depth }: PropertyNodeProps) {
	const isExpandable = value.properties !== undefined && value.properties.length > 0
	const [expanded, setExpanded] = useState(false)

	const toggle = useCallback(() => {
		if (isExpandable) setExpanded((prev) => !prev)
	}, [isExpandable])

	return (
		<div style={{ paddingLeft: depth * 12 }}>
			<div
				className={cn(
					"group flex items-start gap-0.5 py-px",
					isExpandable && "cursor-pointer",
				)}
				onClick={toggle}
			>
				{isExpandable ? (
					<ChevronRight
						size={10}
						className={cn(
							"mt-[3px] flex-shrink-0 text-muted-foreground transition-transform",
							expanded && "rotate-90",
						)}
					/>
				) : (
					<span className="inline-block w-[10px] flex-shrink-0" />
				)}
				<span className="font-mono text-purple-700 dark:text-purple-300">{name}</span>
				<span className="text-muted-foreground">:&nbsp;</span>
				{expanded ? (
					<span className="font-mono text-muted-foreground">
						{value.type === "array"
							? `Array(${value.length})`
							: value.className
								? `${value.className} {…}`
								: "{…}"}
					</span>
				) : (
					<InlinePreview value={value} />
				)}
			</div>
			{expanded && value.properties && (
				<div>
					{value.properties.map((prop) => (
						<PropertyNode
							key={prop.key}
							name={prop.key}
							value={prop.value}
							depth={depth + 1}
						/>
					))}
					{value.truncated && (
						<div
							className="py-px text-muted-foreground"
							style={{ paddingLeft: (depth + 1) * 12 }}
						>
							…
						</div>
					)}
				</div>
			)}
		</div>
	)
}

// ─── Root inspector ──────────────────────────────────────────────────────────

interface ObjectInspectorProps {
	value: SerializedValue
	/** Whether this is a top-level eval result (shows with expand arrow) */
	isRoot?: boolean
}

export function ObjectInspector({ value, isRoot = true }: ObjectInspectorProps) {
	const isExpandable = value.properties !== undefined && value.properties.length > 0
	const [expanded, setExpanded] = useState(false)

	const toggle = useCallback(() => {
		if (isExpandable) setExpanded((prev) => !prev)
	}, [isExpandable])

	// Simple primitives — no expand arrow
	if (!isExpandable) {
		return <span className={cn("font-mono", getValueColor(value.type))}>{value.preview}</span>
	}

	return (
		<div className="font-mono">
			<div
				className={cn("flex items-start gap-0.5", isRoot && "cursor-pointer")}
				onClick={toggle}
			>
				<ChevronRight
					size={10}
					className={cn(
						"mt-[3px] flex-shrink-0 text-muted-foreground transition-transform",
						expanded && "rotate-90",
					)}
				/>
				<InlinePreview value={value} />
			</div>
			{expanded && value.properties && (
				<div className="ml-1">
					{value.properties.map((prop) => (
						<PropertyNode key={prop.key} name={prop.key} value={prop.value} depth={1} />
					))}
					{value.truncated && (
						<div className="py-px text-muted-foreground" style={{ paddingLeft: 12 }}>
							…
						</div>
					)}
				</div>
			)}
		</div>
	)
}
