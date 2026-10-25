import { useTranslation } from "react-i18next"
import { getDomTreeSemanticLabel } from "../../DOMTreePanel/domTreeModel"
import { useStylePanelStore } from "../../../iframe-bridge/contexts/StylePanelContext"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import type { SelectedElementInfo } from "../types"
import { formatUsedSizeLabel } from "../utils/dimensionValue"
import { buildAncestorCrumbs } from "../utils/ancestorBreadcrumb"

interface SelectionReadoutProps {
	selectedElement: SelectedElementInfo | null
	editorRef?: React.RefObject<HTMLEditorV2Ref>
}

export function SelectionReadout({ selectedElement, editorRef }: SelectionReadoutProps) {
	const { t } = useTranslation("super")
	const stylePanelStore = useStylePanelStore()
	const emptyLabel = t("stylePanel.selectionReadoutEmpty")

	if (!selectedElement) {
		return (
			<div
				data-testid="html-editor-selection-readout"
				aria-label={emptyLabel}
				className="ml-2 flex shrink-0 items-center text-[11px] leading-none text-muted-foreground"
			>
				<span className="shrink-0">{emptyLabel}</span>
			</div>
		)
	}

	const crumbs = buildAncestorCrumbs(
		{
			selector: selectedElement.selector,
			tagName: selectedElement.tagName,
			textContent: selectedElement.textContent,
			rect: undefined,
		},
		selectedElement.ancestors ?? [],
	)
	const width = formatUsedSizeLabel(selectedElement.computedStyles?.width)
	const height = formatUsedSizeLabel(selectedElement.computedStyles?.height)
	const pathLabel = crumbs.items
		.map((item) => {
			const semantic = getDomTreeSemanticLabel(t, item.semanticKey)
			return item.isCurrent && item.text ? `${semantic} · ${item.text}` : semantic
		})
		.join(" › ")

	return (
		<div
			data-testid="html-editor-selection-readout"
			aria-label={t("stylePanel.selectionReadout", { tag: pathLabel, width, height })}
			className="ml-2 flex min-w-0 max-w-[min(100%,22rem)] items-center gap-2 overflow-hidden whitespace-nowrap text-[11px] leading-none text-muted-foreground"
		>
			<nav
				data-testid="html-editor-selection-breadcrumb"
				className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden"
			>
				{crumbs.overflow ? (
					<button
						type="button"
						data-testid="html-editor-selection-breadcrumb-overflow"
						className="shrink-0 text-muted-foreground hover:text-foreground"
						onMouseEnter={() =>
							stylePanelStore.setPreviewRect(crumbs.hiddenAncestor?.rect ?? null)
						}
						onMouseLeave={() => stylePanelStore.setPreviewRect(null)}
						onClick={() => {
							const selector = crumbs.hiddenAncestor?.selector
							if (selector) void editorRef?.current?.selectElement(selector)
						}}
					>
						…
					</button>
				) : null}
				{crumbs.items.map((item, index) => {
					const semantic = getDomTreeSemanticLabel(t, item.semanticKey)
					// Ancestors stay short; only the current crumb keeps excerpt text.
					const label =
						item.isCurrent && item.text ? `${semantic} · ${item.text}` : semantic
					return (
						<span key={item.selector} className="flex min-w-0 items-center gap-1">
							{index > 0 || crumbs.overflow ? (
								<span
									aria-hidden
									className="shrink-0 text-sm leading-none text-muted-foreground"
								>
									›
								</span>
							) : null}
							<button
								type="button"
								title={label}
								data-testid={`html-editor-selection-breadcrumb-${item.isCurrent ? "current" : "ancestor"}`}
								disabled={item.isCurrent}
								className={
									item.isCurrent
										? "min-w-0 truncate font-medium text-foreground"
										: "min-w-0 max-w-[6rem] truncate hover:text-foreground"
								}
								onMouseEnter={() =>
									stylePanelStore.setPreviewRect(item.rect ?? null)
								}
								onMouseLeave={() => stylePanelStore.setPreviewRect(null)}
								onClick={() => {
									if (!item.isCurrent)
										void editorRef?.current?.selectElement(item.selector)
								}}
							>
								{label}
							</button>
						</span>
					)
				})}
			</nav>
			<span className="h-3 w-px shrink-0 bg-border" aria-hidden />
			<span className="shrink-0 tabular-nums">
				{width} × {height}
			</span>
		</div>
	)
}
