import type { HelpLocation as HelpLocationData } from "./types"

/** 场景与文件路径分别排版，隐藏文件的前导点不会与分隔符混淆。 */
export function HelpLocation({ scope, path }: HelpLocationData) {
	return (
		<span className="inline-flex min-w-0 items-center gap-3 text-xs leading-5">
			<span className="shrink-0 font-normal text-muted-foreground">{scope}</span>
			<span aria-hidden className="h-4 shrink-0 border-l border-border" />
			<code className="min-w-0 break-words font-mono [overflow-wrap:anywhere]">{path}</code>
		</span>
	)
}
