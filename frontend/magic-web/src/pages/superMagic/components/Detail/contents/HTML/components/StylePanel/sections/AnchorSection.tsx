import { useEffect, useState } from "react"
import { ChevronDown, Link2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/shadcn-ui/input"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/shadcn-ui/collapsible"
import { cn } from "@/utils/cn"
import type { SelectedElementInfo } from "../types"
import { STYLE_PANEL_STYLES } from "../styles"
import { isSafeHref } from "@dtyq/html-sandbox"

interface AnchorSectionProps {
	selectedElement: SelectedElementInfo
	disabled?: boolean
	onUpdate: (attributes: Record<string, string | null>) => Promise<void>
}

type AnchorField = "href" | "title" | "ariaLabel"

const EMPTY_ATTRIBUTES: NonNullable<SelectedElementInfo["attributes"]> = {}

export function AnchorSection({ selectedElement, disabled = false, onUpdate }: AnchorSectionProps) {
	const { t } = useTranslation("super")
	const attributes = selectedElement.attributes ?? EMPTY_ATTRIBUTES
	const hrefField = selectedElement.tagName.toLowerCase() === "a" ? "href" : "dataMagicHref"
	const [draft, setDraft] = useState({ ...attributes, href: attributes[hrefField] })
	const [advancedOpen, setAdvancedOpen] = useState(false)

	useEffect(() => {
		const nextAttributes = selectedElement.attributes ?? EMPTY_ATTRIBUTES
		setDraft({ ...nextAttributes, href: nextAttributes[hrefField] })
		setAdvancedOpen(false)
	}, [selectedElement.selector, selectedElement.attributes, hrefField])

	const commit = async (field: AnchorField, value: string) => {
		const normalized = value.trim()
		if (field === "href" && !isSafeHref(normalized)) {
			setDraft((current) => ({ ...current, href: attributes[hrefField] ?? "" }))
			return
		}
		const nextValue = normalized || null
		setDraft((current) => ({ ...current, [field]: normalized }))
		const attributeField = field === "href" ? hrefField : field
		const hasHref = field === "href" && normalized.length > 0
		if (
			(attributes[attributeField] ?? "") === normalized &&
			(!hasHref || (attributes.target === "_blank" && attributes.download == null))
		)
			return
		await onUpdate({
			[attributeField]: nextValue,
			// A configured navigation link must not retain an old download action.
			...(hasHref ? { target: "_blank", download: null } : {}),
		})
	}

	const inputField = (
		field: AnchorField,
		label: string,
		placeholder: string,
		type: "text" | "url" = "text",
	) => (
		<label className={cn("block", STYLE_PANEL_STYLES.field)}>
			<span className={STYLE_PANEL_STYLES.label}>{label}</span>
			<Input
				type={type}
				value={draft[field] ?? ""}
				onChange={(event) =>
					setDraft((current) => ({ ...current, [field]: event.target.value }))
				}
				onBlur={(event) => void commit(field, event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.currentTarget.blur()
					}
				}}
				placeholder={placeholder}
				disabled={disabled}
				className={STYLE_PANEL_STYLES.control}
			/>
		</label>
	)

	return (
		<div className={STYLE_PANEL_STYLES.section} data-testid="style-panel-anchor-section">
			<div className={cn(STYLE_PANEL_STYLES.sectionTitle, "flex items-center gap-1.5")}>
				<Link2 className="h-3.5 w-3.5 text-muted-foreground" />
				<span>{t("stylePanel.linkSettings")}</span>
			</div>
			<div className="space-y-2 px-1">
				{inputField(
					"href",
					t("stylePanel.linkUrl"),
					t("stylePanel.linkUrlPlaceholder"),
					"url",
				)}

				<Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
					<CollapsibleTrigger
						type="button"
						className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<span>{t("stylePanel.linkAdvanced")}</span>
						<ChevronDown
							className={cn(
								"h-3.5 w-3.5 transition-transform",
								advancedOpen && "rotate-180",
							)}
						/>
					</CollapsibleTrigger>
					<CollapsibleContent className="space-y-2 pt-1">
						{inputField(
							"title",
							t("stylePanel.linkTitle"),
							t("stylePanel.linkTitlePlaceholder"),
						)}
						{inputField(
							"ariaLabel",
							t("stylePanel.linkAriaLabel"),
							t("stylePanel.linkAriaLabelPlaceholder"),
						)}
					</CollapsibleContent>
				</Collapsible>
			</div>
		</div>
	)
}
