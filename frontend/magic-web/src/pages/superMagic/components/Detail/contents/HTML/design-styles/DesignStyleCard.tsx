import type { MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import type { DesignStyle } from "./catalog"
import { getStyleProfile } from "./styleProfiles"
import { getSceneTheme } from "./sceneTheme"
import DesignStyleThumbnail from "./DesignStyleThumbnail"

interface DesignStyleCardProps {
	style: DesignStyle
	onSelect: (event: MouseEvent<HTMLButtonElement>) => void
}

export default function DesignStyleCard({ style, onSelect }: DesignStyleCardProps) {
	const { i18n } = useTranslation("super")
	const language = (i18n.resolvedLanguage || i18n.language || "en").startsWith("zh") ? "zh" : "en"
	const profile = getStyleProfile(style.code)
	const theme = getSceneTheme(style)

	return (
		<article className="group relative w-full min-w-0 overflow-hidden rounded-lg border border-border/70 bg-background text-left transition-colors hover:border-foreground/30">
			<DesignStyleThumbnail style={style} />

			<div className="px-3 pb-3 pt-3">
				<div className="mb-1 flex items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-1.5">
						<span className="truncate text-sm font-semibold text-foreground">
							{profile?.name[language] ?? style.title}
						</span>
					</div>
					<span className="flex shrink-0 gap-1" aria-hidden="true">
						{[theme.background, theme.primary, theme.foreground].map((color, index) => (
							<i
								key={index}
								className="size-2.5 rounded-full ring-1 ring-inset ring-foreground/10"
								style={{ backgroundColor: color }}
							/>
						))}
					</span>
				</div>
				<div>
					<span className="line-clamp-1 text-xs leading-5 text-muted-foreground">
						{profile?.description[language] ?? style.description}
					</span>
				</div>
			</div>
			<button
				type="button"
				aria-label={profile?.name[language] ?? style.title}
				className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
				onClick={onSelect}
				data-testid={`design-style-card-${style.code}`}
			/>
		</article>
	)
}
