import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { DesignStyle } from "./catalog"
import { useDesignStyleSource } from "./useDesignStyleSource"

/** Split trusted structure only; source text is rendered as text, never executable HTML. */
export function splitDesignStyleSections(source: string) {
	const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "")
	const sections: { title: string; content: string }[] = []
	let current = { title: "", content: "" }
	let fence: string | null = null
	for (const line of body.split(/\r?\n/)) {
		const marker = line.match(/^\s*(`{3,}|~{3,})/)
		if (marker) {
			if (!fence) fence = marker[1]
			else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null
		}
		const heading = !fence && line.match(/^#{1,3}\s+(.+)$/)
		if (heading) {
			if (current.content.trim()) sections.push(current)
			current = { title: heading[1], content: "" }
		} else current.content += `${line}\n`
	}
	if (current.content.trim()) sections.push(current)
	return sections
}

export default function DesignStyleSourceSections({ style }: { style: DesignStyle }) {
	const { t } = useTranslation("super")
	const { source, status, retry } = useDesignStyleSource(style.code, true)
	const sections = useMemo(
		() => splitDesignStyleSections(source?.content ?? ""),
		[source?.content],
	)
	if (status === "loading" || status === "idle")
		return (
			<p role="status" className="py-4 text-xs text-muted-foreground">
				{t("htmlEditor.designStyle.rawSourceLoading")}
			</p>
		)
	if (status === "error")
		return (
			<div className="py-4 text-sm">
				<p role="alert">{t("htmlEditor.designStyle.rawSourceError")}</p>
				<button
					type="button"
					className="mt-2 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
					onClick={retry}
				>
					{t("htmlEditor.designStyle.rawSourceRetry")}
				</button>
			</div>
		)
	return (
		<div className="divide-y divide-border/60" data-testid="design-style-source-sections">
			{sections.length ? (
				sections.map((section, index) => (
					<details key={index} open={sections.length === 1}>
						<summary className="cursor-pointer py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
							{section.title || t("htmlEditor.designStyle.guidelinesTitle")}
						</summary>
						<div className="max-w-[75ch] whitespace-pre-wrap break-words pb-5 text-sm leading-7 text-muted-foreground">
							{section.content}
						</div>
					</details>
				))
			) : (
				<p className="py-4 text-xs text-muted-foreground">
					{t("htmlEditor.designStyle.sourceFrontmatterOnly")}
				</p>
			)}
		</div>
	)
}
