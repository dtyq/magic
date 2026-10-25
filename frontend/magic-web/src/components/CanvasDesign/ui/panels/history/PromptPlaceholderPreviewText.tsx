import { Fragment, useMemo } from "react"
import {
	parsePromptPlaceholderTokenMatches,
	type PromptPlaceholderTokenConfig,
	type PromptPlaceholderTokenKind,
} from "../../editors/message/reference-assets/promptPlaceholderTokenConfig"
import type { MediaResourceFullscreenPreviewItem } from "../../fullscreen/media-resource/index"
import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"
import {
	getCanvasResourceAvailability,
	isOpaqueAssetReference,
} from "../../../runtime/shared/path/canvasResourcePath"
import { buildPreviewMediaResourceItem } from "./mediaPreviewItem"
import styles from "./PromptPlaceholderPreviewText.module.css"

interface PromptPlaceholderPreviewTextProps {
	text: string
	tokenConfig: PromptPlaceholderTokenConfig
	placeholderPaths: Partial<Record<PromptPlaceholderTokenKind, string[]>>
	onPreviewMediaResource: (resource: MediaResourceFullscreenPreviewItem) => void
	resolveResourceReference?: ResolveCanvasResourceReference
	deletedSuffix: string
}

type PromptSegment =
	| {
			key: string
			type: "text"
			value: string
	  }
	| {
			key: string
			type: "placeholder"
			value: string
			path?: string
			previewItem: MediaResourceFullscreenPreviewItem | null
			isDeleted: boolean
	  }

function getPlaceholderDisplayValue(
	segment: Extract<PromptSegment, { type: "placeholder" }>,
	deletedSuffix: string,
): string {
	const displayValue = segment.previewItem?.fileName
		? `@${segment.previewItem.fileName}`
		: segment.path && isOpaqueAssetReference(segment.path)
			? `@${segment.path}`
			: segment.value
	return segment.previewItem && segment.isDeleted
		? `${displayValue}${deletedSuffix}`
		: displayValue
}

export function PromptPlaceholderPreviewText(props: PromptPlaceholderPreviewTextProps) {
	const {
		text,
		tokenConfig,
		placeholderPaths,
		onPreviewMediaResource,
		resolveResourceReference,
		deletedSuffix,
	} = props
	const segments = useMemo<PromptSegment[]>(() => {
		const matches = parsePromptPlaceholderTokenMatches(text, tokenConfig)
		if (matches.length === 0) {
			return [{ key: "text:0", type: "text", value: text }]
		}

		const nextSegments: PromptSegment[] = []
		let cursor = 0

		for (const match of matches) {
			if (match.start > cursor) {
				nextSegments.push({
					key: `text:${cursor}`,
					type: "text",
					value: text.slice(cursor, match.start),
				})
			}

			const path = placeholderPaths[match.kind]?.[match.index - 1]
			const previewItem = path ? buildPreviewMediaResourceItem(path, match.kind) : null
			const availability = getCanvasResourceAvailability(path, resolveResourceReference)
			nextSegments.push({
				key: `placeholder:${match.start}`,
				type: "placeholder",
				value: match.rawText,
				path,
				previewItem,
				isDeleted: availability === "deleted",
			})
			cursor = match.end
		}

		if (cursor < text.length) {
			nextSegments.push({
				key: `text:${cursor}`,
				type: "text",
				value: text.slice(cursor),
			})
		}

		return nextSegments
	}, [placeholderPaths, resolveResourceReference, text, tokenConfig])

	return segments.map((segment) => {
		if (segment.type === "text") {
			return <Fragment key={segment.key}>{segment.value}</Fragment>
		}

		const displayValue = getPlaceholderDisplayValue(segment, deletedSuffix)
		if (!segment.previewItem) {
			return segment.path && isOpaqueAssetReference(segment.path) ? (
				<span key={segment.key} className={styles.opaquePlaceholder}>
					{displayValue}
				</span>
			) : (
				<Fragment key={segment.key}>{segment.value}</Fragment>
			)
		}

		const previewItem = segment.previewItem

		if (segment.isDeleted) {
			return (
				<span
					key={segment.key}
					className={styles.deletedPlaceholder}
					data-testid="deleted-resource-placeholder"
				>
					{displayValue}
				</span>
			)
		}

		return (
			<button
				key={segment.key}
				type="button"
				className={styles.placeholderButton}
				title={previewItem.fileName}
				onClick={() => {
					onPreviewMediaResource(previewItem)
				}}
			>
				{displayValue}
			</button>
		)
	})
}
