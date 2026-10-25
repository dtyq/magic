import { useMemo, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { ArrowUpRight, Lightbulb } from "lucide-react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useLocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/hooks/useLocaleText"
import {
	getOptionValue,
	resolveDemoPromptText,
} from "@/pages/superMagic/components/MainInputContainer/panels/utils"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { cn } from "@/utils/cn"
import type { AiCanvasInspirationGroup } from "../hooks/useDesignInspirations"

const ALL_GROUP_KEY = "__all__"

interface AiCanvasInspirationsProps {
	groups: AiCanvasInspirationGroup[]
	/** Called after a prompt was sent to the composer, e.g. to scroll it into view. */
	onPromptApplied?: () => void
}

/**
 * Large-image inspiration wall. Cards keep each artwork's natural ratio in CSS columns
 * (supported by the Chrome 100 baseline) and reveal the prompt on hover or keyboard focus.
 * Picking a card fills the composer through the same event the scene demo panel uses;
 * nothing is created until the user sends.
 */
function AiCanvasInspirations({ groups, onPromptApplied }: AiCanvasInspirationsProps) {
	const { t, i18n } = useTranslation("aiCanvas")
	const lt = useLocaleText()
	const [activeKey, setActiveKey] = useState(ALL_GROUP_KEY)

	const items = useMemo(() => {
		const source =
			activeKey === ALL_GROUP_KEY ? groups : groups.filter((group) => group.key === activeKey)
		return source.flatMap((group) =>
			group.items.map((item) => ({ key: `${group.key}:${getOptionValue(item)}`, item })),
		)
	}, [activeKey, groups])

	if (groups.length === 0) return null

	const applyPrompt = (item: OptionItem) => {
		const prompt = resolveDemoPromptText(item, i18n.language)
		if (!prompt) return
		pubsub.publish(PubSubEvents.Set_Demo_Text_To_Input, prompt)
		onPromptApplied?.()
	}

	const tabs = [
		{ key: ALL_GROUP_KEY, label: t("home.inspirationAll") },
		...groups.map((group) => ({ key: group.key, label: lt(group.name) })),
	]

	return (
		<section className="flex flex-col gap-5" data-testid="ai-canvas-inspirations">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
						<Lightbulb size={16} aria-hidden="true" />
						{t("home.inspirationTitle")}
					</h2>
					<p className="text-sm text-muted-foreground">{t("home.inspirationSubtitle")}</p>
				</div>
				{groups.length > 1 ? (
					<div className="flex flex-wrap gap-1.5" role="tablist">
						{tabs.map((tab) => (
							<button
								key={tab.key}
								type="button"
								role="tab"
								aria-selected={activeKey === tab.key}
								onClick={() => setActiveKey(tab.key)}
								className={cn(
									"h-8 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									activeKey === tab.key
										? "border-foreground bg-foreground text-background"
										: "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
								)}
							>
								{tab.label}
							</button>
						))}
					</div>
				) : null}
			</div>

			<div className="columns-2 gap-4 md:columns-3 xl:columns-4">
				{items.map(({ key, item }) => {
					const title = lt(item.label) || lt(item.value)
					const prompt = resolveDemoPromptText(item, i18n.language)
					return (
						<button
							key={key}
							type="button"
							onClick={() => applyPrompt(item)}
							className="group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-muted text-left ring-1 ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							{item.thumbnail_url ? (
								<img
									src={item.thumbnail_url}
									alt={title}
									loading="lazy"
									className="block w-full transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
								/>
							) : (
								<div className="flex aspect-[4/3] items-center justify-center p-4 text-sm text-muted-foreground">
									{title}
								</div>
							)}
							{/* Gradient scrim keeps white text readable on any artwork. */}
							<div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-3 pt-10 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
								<div className="flex items-center justify-between gap-2 text-sm font-medium">
									<span className="truncate">{title}</span>
									<span className="inline-flex shrink-0 items-center gap-0.5 text-xs">
										{t("home.useInspiration")}
										<ArrowUpRight size={12} />
									</span>
								</div>
								{prompt ? (
									<p className="line-clamp-2 text-xs text-white/80">{prompt}</p>
								) : null}
							</div>
						</button>
					)
				})}
			</div>
		</section>
	)
}

export default observer(AiCanvasInspirations)
