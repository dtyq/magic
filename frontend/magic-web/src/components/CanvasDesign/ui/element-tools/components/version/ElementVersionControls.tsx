import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react"
import { useCallback, useMemo } from "react"
import { ElementToolTypeEnum } from "../../../../public/props"
import type { ElementToolType } from "../../../../public/props"
import { useCanvasDesignI18n } from "../../../../app/providers/I18nProvider"
import { useCanvasPanelUI } from "../../../../app/providers/CanvasUIProvider"
import type { AudioElement, ImageElement, VideoElement } from "../../../../runtime/document/types"
import styles from "./ElementVersionControls.module.css"
import type { ElementToolResolution } from "../../../../runtime/element-tools"

type VersionElement = ImageElement | VideoElement | AudioElement

interface ElementVersionControlsProps {
	/** Kept for compatibility with existing direct consumers; Resolver owns the state. */
	element?: VersionElement
	tools: readonly ElementToolResolution[]
}

export default function ElementVersionControls({ element, tools }: ElementVersionControlsProps) {
	const { t } = useCanvasDesignI18n()
	const { versionPanelElementId, toggleVersionPanel } = useCanvasPanelUI()
	const toolsById = useMemo(() => new Map(tools.map((tool) => [tool.id, tool])), [tools])
	const versionData = toolsById.get(ElementToolTypeEnum.VersionCount)?.data?.version
	const elementId =
		toolsById.get(ElementToolTypeEnum.VersionCount)?.target.elementId ?? element?.id
	const activeIndex = Math.max(0, (versionData?.current ?? 1) - 1)
	const total = versionData?.total ?? 0
	const getTool = useCallback((toolId: ElementToolType) => toolsById.get(toolId), [toolsById])
	const canSwitchVersions =
		getTool(ElementToolTypeEnum.VersionPrevious)?.visibility === "visible" ||
		getTool(ElementToolTypeEnum.VersionNext)?.visibility === "visible"
	const isExpanded = Boolean(elementId && versionPanelElementId === elementId)

	const switchActive = useCallback(
		(
			toolId:
				typeof ElementToolTypeEnum.VersionPrevious | typeof ElementToolTypeEnum.VersionNext,
		) => {
			void Promise.resolve(getTool(toolId)?.execute?.())
		},
		[getTool],
	)

	const handleToggleExpansion = useCallback(() => {
		if (!elementId) return
		toggleVersionPanel(elementId)
	}, [elementId, toggleVersionPanel])

	const label = useMemo(
		() =>
			t("elementBottomToolbar.versionCount", {
				defaultValue: "{{current}}/{{total}}",
				current: activeIndex + 1,
				total,
			}),
		[activeIndex, t, total],
	)
	if (total <= 1 || tools.length === 0) return null

	return (
		<div className={styles.root} data-testid="element-version-controls">
			<button
				type="button"
				className={styles.iconButton}
				disabled={
					activeIndex <= 0 ||
					getTool(ElementToolTypeEnum.VersionPrevious)?.visibility !== "visible"
				}
				aria-label={t("elementBottomToolbar.previousVersion", "上一个版本")}
				onClick={() => switchActive(ElementToolTypeEnum.VersionPrevious)}
			>
				<ChevronLeft size={14} />
			</button>
			<span className={styles.count} aria-live="polite">
				{label}
			</span>
			<button
				type="button"
				className={styles.iconButton}
				disabled={
					activeIndex >= total - 1 ||
					getTool(ElementToolTypeEnum.VersionNext)?.visibility !== "visible"
				}
				aria-label={t("elementBottomToolbar.nextVersion", "下一个版本")}
				onClick={() => switchActive(ElementToolTypeEnum.VersionNext)}
			>
				<ChevronRight size={14} />
			</button>
			{elementId && (
				<button
					type="button"
					className={styles.actionButton}
					disabled={!canSwitchVersions}
					aria-pressed={isExpanded}
					aria-label={
						isExpanded
							? t("elementBottomToolbar.collapseVersions", "收起版本")
							: t("elementBottomToolbar.viewVersions", "查看版本")
					}
					onClick={handleToggleExpansion}
				>
					<LayoutGrid size={14} />
					<span>
						{isExpanded
							? t("elementBottomToolbar.collapseVersions", "收起版本")
							: t("elementBottomToolbar.viewVersions", "查看版本")}
					</span>
				</button>
			)}
		</div>
	)
}
