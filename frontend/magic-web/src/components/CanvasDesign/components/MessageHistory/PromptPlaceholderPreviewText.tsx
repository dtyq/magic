import { Fragment, useMemo } from "react"
import {
	parsePromptPlaceholderTokenMatches,
	type PromptPlaceholderTokenConfig,
	type PromptPlaceholderTokenKind,
} from "../MessageEditor/reference-assets/promptPlaceholderTokenConfig"
import type { MediaResourceFullscreenPreviewItem } from "../MediaResourceFullscreenPreview"
import { buildPreviewMediaResourceItem } from "./mediaPreviewItem"
import styles from "./PromptPlaceholderPreviewText.module.css"

interface PromptPlaceholderPreviewTextProps {
	text: string
	tokenConfig: PromptPlaceholderTokenConfig
	placeholderPaths: Partial<Record<PromptPlaceholderTokenKind, string[]>>
	onPreviewMediaResource: (resource: MediaResourceFullscreenPreviewItem) => void
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
			previewItem: MediaResourceFullscreenPreviewItem | null
	  }

export function PromptPlaceholderPreviewText(props: PromptPlaceholderPreviewTextProps) {
	const { text, tokenConfig, placeholderPaths, onPreviewMediaResource } = props
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
			nextSegments.push({
				key: `placeholder:${match.start}`,
				type: "placeholder",
				value: match.rawText,
				previewItem: path ? buildPreviewMediaResourceItem(path) : null,
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
	}, [placeholderPaths, text, tokenConfig])

	return segments.map((segment) => {
		if (segment.type === "text") {
			return <Fragment key={segment.key}>{segment.value}</Fragment>
		}

		if (!segment.previewItem) {
			return <Fragment key={segment.key}>{segment.value}</Fragment>
		}

		const previewItem = segment.previewItem

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
				{segment.value}
			</button>
		)
	})
}
