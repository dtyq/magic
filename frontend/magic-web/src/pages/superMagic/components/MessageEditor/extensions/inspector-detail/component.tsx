import { Fragment, useState } from "react"
import { NodeViewWrapper } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import { ChevronRight, ChevronDown, Crosshair } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import type { InspectorDetailAttrs } from "./types"

export const InspectorDetailComponent: React.FC<NodeViewProps> = ({ node, selected }) => {
	const attrs = node.attrs as InspectorDetailAttrs
	const [expanded, setExpanded] = useState(false)
	const { t } = useTranslation("super")

	const parsedStyles: Record<string, string> = (() => {
		try {
			return JSON.parse(attrs.computedStyles || "{}")
		} catch {
			return {}
		}
	})()
	const styleEntries = Object.entries(parsedStyles)

	// Build summary: tagName | size | N styles
	const summaryParts: string[] = []
	if (attrs.tagName) summaryParts.push(attrs.tagName)
	if (attrs.size) summaryParts.push(attrs.size)
	if (attrs.styleCount > 0)
		summaryParts.push(
			`${attrs.styleCount} ${t("stylePanel.inspector.computedStyles").toLowerCase()}`,
		)

	return (
		<NodeViewWrapper
			as="div"
			data-type="inspector-detail"
			className={cn(
				"my-0.5 select-none rounded-md border transition-colors",
				selected
					? "border-primary/50 bg-primary/5"
					: "border-border/60 bg-muted/30 hover:border-border",
			)}
		>
			{/* Collapsed header — always visible */}
			<button
				type="button"
				className={cn(
					"flex w-full cursor-pointer items-center gap-1 px-2 py-1 text-left text-xs",
					expanded && "border-b border-border/40",
				)}
				onClick={() => setExpanded((v) => !v)}
				contentEditable={false}
			>
				<Crosshair size={12} className="flex-shrink-0 text-muted-foreground/70" />
				<span className="min-w-0 flex-1 truncate font-medium text-foreground/80">
					{summaryParts.join(" · ")}
				</span>
				{expanded ? (
					<ChevronDown size={12} className="flex-shrink-0 text-muted-foreground/50" />
				) : (
					<ChevronRight size={12} className="flex-shrink-0 text-muted-foreground/50" />
				)}
			</button>

			{/* Expanded detail panel */}
			{expanded && (
				<div
					className="space-y-1 px-2 py-1.5 text-[11px] text-foreground/70"
					contentEditable={false}
				>
					{/* Selector */}
					{attrs.selector && (
						<div className="flex gap-1.5">
							<span className="flex-shrink-0 text-foreground/50">
								{t("stylePanel.inspector.selector")}
							</span>
							<code className="min-w-0 break-all font-mono text-foreground/70">
								{attrs.selector}
							</code>
						</div>
					)}

					{/* Size */}
					{attrs.size && (
						<div className="flex gap-1.5">
							<span className="flex-shrink-0 text-foreground/50">
								{t("stylePanel.inspector.size")}
							</span>
							<span>{attrs.size}</span>
						</div>
					)}

					{/* Computed styles */}
					{styleEntries.length > 0 && (
						<div>
							<span className="text-foreground/50">
								{t("stylePanel.inspector.computedStyles")}
							</span>
							<div className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-px rounded bg-muted/50 px-1.5 py-1 font-mono text-[11px]">
								{styleEntries.map(([prop, value]) => (
									<Fragment key={prop}>
										<span className="text-foreground/50">{prop}:</span>
										<span className="min-w-0 break-all text-foreground/70">
											{value}
										</span>
									</Fragment>
								))}
							</div>
						</div>
					)}

					{/* Text content */}
					{attrs.textContent && (
						<div className="flex gap-1.5">
							<span className="flex-shrink-0 text-foreground/50">
								{t("stylePanel.inspector.textContent")}
							</span>
							<span className="min-w-0 break-all italic">
								&ldquo;{attrs.textContent}&rdquo;
							</span>
						</div>
					)}
				</div>
			)}
		</NodeViewWrapper>
	)
}
