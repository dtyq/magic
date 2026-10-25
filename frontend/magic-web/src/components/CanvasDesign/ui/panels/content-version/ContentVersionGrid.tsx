import { Crown, Trash2 } from "lucide-react"
import { useCallback, useState } from "react"
import { GenerationStatus } from "../../../public/magic-types"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { getContentState } from "../../../runtime/document/elementContent"
import type { AudioElement, ImageElement, VideoElement } from "../../../runtime/document/types"
import ContentVersionMedia, { ContentVersionAudioControl } from "./ContentVersionMedia"
import styles from "./index.module.css"

export type ContentVersionElement = ImageElement | VideoElement | AudioElement

interface ContentVersionGridProps {
	element: ContentVersionElement
	effectiveContentId?: string
	busyContentId?: string
	canDelete: boolean
	canSetMain: boolean
	onSelect: (contentId: string) => void
	onDelete: (contentId: string) => void
	onSetMain: (contentId: string) => void
}

function canUseAsMain(element: ContentVersionElement, contentId: string): boolean {
	const content = element.contents.find((item) => item.contentId === contentId)
	if (!content?.src) return false
	if (!("status" in content)) return true
	return content.status === GenerationStatus.Completed
}

export default function ContentVersionGrid({
	element,
	effectiveContentId: effectiveContentIdProp,
	busyContentId,
	canDelete,
	canSetMain,
	onSelect,
	onDelete,
	onSetMain,
}: ContentVersionGridProps) {
	const { t } = useCanvasDesignI18n()
	const [hoveredContentId, setHoveredContentId] = useState<string>()
	const [activeAudioContentId, setActiveAudioContentId] = useState<string>()
	const handleAudioPlaybackChange = useCallback((contentId: string, playing: boolean) => {
		setActiveAudioContentId((current) => {
			if (playing) return contentId
			return current === contentId ? undefined : current
		})
	}, [])

	return (
		<div className={styles.grid} data-testid="content-version-grid">
			{element.contents.map((content, index) => {
				const version = index + 1
				const contentState = getContentState(content)
				const isActive = content.contentId === effectiveContentIdProp
				const isMain = content.contentId === element.mainContentId
				const isBusy = busyContentId === content.contentId
				const isHovered = hoveredContentId === content.contentId
				const canPromote = canSetMain && !isMain && canUseAsMain(element, content.contentId)
				const audioPath =
					element.type === "audio" && contentState === "completed"
						? content.src
						: undefined

				return (
					<article
						key={content.contentId}
						className={styles.card}
						data-active={isActive}
						data-main={isMain}
						onMouseEnter={() => setHoveredContentId(content.contentId)}
						onMouseLeave={() => setHoveredContentId(undefined)}
					>
						<button
							type="button"
							className={styles.selectButton}
							data-floating-pan-through="true"
							aria-pressed={isActive}
							aria-label={t("elementBottomToolbar.switchToVersion", {
								defaultValue: "切换到 V{{number}}",
								number: version,
							})}
							disabled={isBusy}
							onClick={() => onSelect(content.contentId)}
						>
							<span className={styles.thumbnail}>
								<ContentVersionMedia
									element={element}
									content={content}
									contentState={contentState}
									playing={isHovered}
								/>
							</span>
							{isMain && (
								<span className={styles.mainBadge}>
									{t("elementBottomToolbar.mainVersion", "主版本")}
								</span>
							)}
						</button>
						{audioPath && (
							<ContentVersionAudioControl
								contentId={content.contentId}
								path={audioPath}
								activeAudioContentId={activeAudioContentId}
								onPlaybackChange={handleAudioPlaybackChange}
							/>
						)}
						{(canDelete || canPromote) && (
							<div className={styles.cardActions}>
								{canPromote && (
									<button
										type="button"
										className={styles.cardAction}
										disabled={isBusy}
										aria-label={t("elementBottomToolbar.setMainVersionNumber", {
											defaultValue: "将 V{{number}} 设为主版本",
											number: version,
										})}
										onClick={() => onSetMain(content.contentId)}
									>
										<Crown size={14} />
									</button>
								)}
								{canDelete && (
									<button
										type="button"
										className={`${styles.cardAction} ${styles.dangerAction}`}
										disabled={isBusy}
										aria-label={t("elementBottomToolbar.deleteVersionNumber", {
											defaultValue: "删除 V{{number}}",
											number: version,
										})}
										onClick={() => onDelete(content.contentId)}
									>
										<Trash2 size={14} />
									</button>
								)}
							</div>
						)}
					</article>
				)
			})}
		</div>
	)
}
