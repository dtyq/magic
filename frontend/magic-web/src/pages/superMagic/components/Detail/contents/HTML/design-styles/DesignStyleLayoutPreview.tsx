import { useTranslation } from "react-i18next"
import type { DesignStyle } from "./catalog"
import { getStyleProfile } from "./styleProfiles"
import { getSceneTheme } from "./sceneTheme"

export default function DesignStyleLayoutPreview({ style }: { style: DesignStyle }) {
	const { t, i18n } = useTranslation("super")
	const profile = getStyleProfile(style.code)
	const language = (i18n.resolvedLanguage || i18n.language || "en").startsWith("zh") ? "zh" : "en"
	const layouts = {
		sidebar: t("htmlEditor.designStyle.layouts.sidebar"),
		split: t("htmlEditor.designStyle.layouts.split"),
		centered: t("htmlEditor.designStyle.layouts.centered"),
		magazine: t("htmlEditor.designStyle.layouts.magazine"),
		grid: t("htmlEditor.designStyle.layouts.grid"),
		stacked: t("htmlEditor.designStyle.layouts.stacked"),
	}
	const layout = profile?.layout ?? "split"
	const columns = {
		sidebar: "1fr 3fr",
		split: "1fr 1fr",
		centered: "1fr",
		magazine: "2fr 3fr",
		grid: "1fr 1fr",
		stacked: "1fr",
	}[layout]
	return (
		<section
			className="flex flex-wrap items-center justify-between gap-6 border-t border-border/60 pt-6 first:border-t-0 first:pt-0"
			data-testid="design-style-layout-preview"
		>
			<div className="min-w-0 max-w-[60ch] flex-1">
				<h3 className="text-sm font-semibold">{t("htmlEditor.designStyle.layoutTitle")}</h3>
				<p className="mt-3 text-xs font-medium">{layouts[layout]}</p>
				<p className="mt-2 text-sm leading-7 text-muted-foreground">
					{profile?.description[language] ?? style.description}
				</p>
			</div>
			<div
				className="grid h-28 w-48 shrink-0 gap-2 bg-[var(--scene-bg)] p-3"
				style={{
					...getSceneTheme(style).variables,
					gridTemplateColumns: columns,
					paddingInline: layout === "centered" ? 40 : 12,
				}}
				aria-hidden="true"
			>
				{[0, 1, 2, 3].map((index) => (
					<span
						key={index}
						className="bg-[var(--scene-primary)] [border-radius:var(--scene-radius)]"
						style={{
							opacity: index ? 0.22 : 0.65,
							gridRow:
								index === 0 && ["sidebar", "split", "magazine"].includes(layout)
									? "span 3"
									: undefined,
						}}
					/>
				))}
			</div>
		</section>
	)
}
