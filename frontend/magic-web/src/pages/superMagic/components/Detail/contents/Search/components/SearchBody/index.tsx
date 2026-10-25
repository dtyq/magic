import { memo, useCallback } from "react"
import { Typography } from "antd"
import { Globe } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicImage from "@/components/base/MagicImage"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

export interface SearchResult {
	title: string
	snippet: string
	url: string
	icon_url?: string
}

export interface SearchGroup {
	keyword: string
	query?: string | null
	results: SearchResult[]
}

interface SearchBodyProps {
	currentGroup?: SearchGroup
}

export default memo(function SearchBody({ currentGroup }: SearchBodyProps) {
	const { t } = useTranslation("super")

	// Parse HTML to extract text content only
	const parseHTML = useCallback((html: string) => {
		return html.replace(/<[^>]*>?/g, "")
	}, [])

	// Highlight keywords in text
	const highlightKeywords = useCallback((text: string, kw: string | string[]) => {
		if (!kw || !text) return text

		const normalizedKeywords = Array.isArray(kw) ? kw : kw.split(/\s+/)
		const keywords = normalizedKeywords
			.filter((word) => word && typeof word === "string" && word.trim().length > 0)
			.map((word) => word.trim())

		if (keywords.length === 0) return text

		try {
			const pattern = keywords
				.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
				.join("|")
			const regex = new RegExp(`(${pattern})`, "gi")
			const parts = text.split(regex)

			// Captures occupy odd indexes; use them directly to avoid global-regex lastIndex state.
			return parts.map((part, index) =>
				index % 2 === 1 ? (
					<strong key={index} className="font-semibold text-foreground">
						{part}
					</strong>
				) : (
					part
				),
			)
		} catch (error) {
			console.warn("Regex error in highlightKeywords:", error)
			return text
		}
	}, [])

	const results = currentGroup?.results || []
	const query = currentGroup?.query || currentGroup?.keyword || ""

	if (!results.length) {
		return (
			// Fill Radix's content wrapper so the empty message stays centered.
			<ScrollArea
				className="grid min-h-0 flex-1"
				viewportClassName="h-auto min-h-0 p-7 text-center [&>div]:!flex [&>div]:min-h-full [&>div]:flex-col [&>div]:items-center [&>div]:justify-center [&>div]:gap-2"
			>
				<p className="text-sm text-foreground">
					{currentGroup ? t("search.emptyGroupTitle") : t("search.emptyResults")}
				</p>
				{currentGroup && (
					<p className="text-xs text-muted-foreground">
						{t("search.emptyGroupDescription")}
					</p>
				)}
			</ScrollArea>
		)
	}

	return (
		<ScrollArea
			className="grid min-h-0 flex-1"
			viewportClassName="h-auto min-h-0 px-4 pb-6 pt-3"
		>
			<div className="flex max-w-[800px] flex-col gap-[18px]">
				{results.map((item, index) => {
					const title = parseHTML(item.title)
					const info = parseHTML(item.snippet)
					let source = item.url
					let sourcePath = ""
					try {
						const url = new URL(item.url)
						source = url.hostname
						sourcePath = url.pathname
					} catch {
						// Preserve an invalid source URL without interrupting the rest of the results.
					}

					return (
						<article key={`${item.url}-${index}`} className="min-w-0">
							<a
								href={item.url}
								target="_blank"
								rel="noopener noreferrer"
								className="mb-1 flex w-fit max-w-full items-center gap-2 text-foreground no-underline hover:no-underline"
								title={item.url}
								data-testid="search-body-link-2"
							>
								<span className="flex size-4 shrink-0 items-center justify-center overflow-hidden">
									<MagicImage
										src={item.icon_url}
										width={16}
										height={16}
										className="rounded-sm"
										fallback={
											<Globe
												size={16}
												className="text-muted-foreground"
												aria-hidden
											/>
										}
									/>
								</span>
								<span className="min-w-0 truncate text-xs leading-5">
									<span>{source}</span>
									{sourcePath && (
										<span className="ml-1.5 text-muted-foreground">
											{sourcePath}
										</span>
									)}
								</span>
							</a>
							<a
								href={item.url}
								target="_blank"
								rel="noopener noreferrer"
								className="mb-1 block break-words text-lg font-normal leading-[1.45] text-blue-700 no-underline hover:underline dark:text-blue-300"
								title={title}
								data-testid="search-body-link"
							>
								{title}
							</a>
							{/* Collapse only the returned snippet; Typography measures overflow and manages expansion. */}
							<Typography.Paragraph
								className="!mb-0 !text-sm !leading-relaxed !text-muted-foreground"
								title={info}
								ellipsis={{
									rows: 3,
									expandable: "collapsible",
									symbol: (expanded) => (
										<span className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4">
											{expanded
												? t("search.collapseSnippet")
												: t("search.expandSnippet")}
										</span>
									),
								}}
							>
								{highlightKeywords(info, query)}
							</Typography.Paragraph>
						</article>
					)
				})}
			</div>
		</ScrollArea>
	)
})
