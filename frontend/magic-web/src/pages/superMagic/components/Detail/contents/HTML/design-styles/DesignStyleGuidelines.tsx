import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { DesignStyle } from "./catalog"
import DesignStyleSourceSections from "./DesignStyleSourceSections"
import DesignStyleRawPreview from "./DesignStyleRawPreview"

/** The catalog provides summaries; authoritative source remains lazy and can be opened in full. */
export default function DesignStyleGuidelines({ style }: { style: DesignStyle }) {
	const { t } = useTranslation("super")
	const [sourceOpen, setSourceOpen] = useState(false)
	const [guidelinesOpen, setGuidelinesOpen] = useState(false)
	return (
		<section
			className="space-y-5 border-t border-border/60 pt-6"
			data-testid="design-style-guidelines"
		>
			<div>
				<h3 className="text-sm font-semibold">
					{t("htmlEditor.designStyle.guidelinesTitle")}
				</h3>
			</div>
			{style.design.components.length > 0 && (
				<div>
					<h4 className="mb-3 text-xs font-medium">
						{t("htmlEditor.designStyle.definedComponents")}
					</h4>
					<p className="break-words font-mono text-xs leading-7 text-muted-foreground">
						{style.design.components.join(" · ")}
					</p>
				</div>
			)}
			<details onToggle={(event) => setGuidelinesOpen(event.currentTarget.open)}>
				<summary className="cursor-pointer py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
					{t("htmlEditor.designStyle.fullGuidelines")}
				</summary>
				<p className="pb-3 text-xs text-muted-foreground">
					{t("htmlEditor.designStyle.originalLanguage")}
				</p>
				{guidelinesOpen && <DesignStyleSourceSections style={style} />}
			</details>
			<details onToggle={(event) => setSourceOpen(event.currentTarget.open)}>
				<summary className="cursor-pointer py-3 text-xs text-muted-foreground underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
					{t("htmlEditor.designStyle.readFullSource")}
				</summary>
				{sourceOpen && <DesignStyleRawPreview style={style} active />}
			</details>
		</section>
	)
}
