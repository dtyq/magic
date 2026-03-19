import { memo, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import MagicImage from "@/components/base/MagicImage"
import defaultSVG from "@/assets/resources/icons/magic-icon.svg"
import { IconListSearch } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"

export interface SearchResult {
	title: string
	snippet: string
	url: string
	icon_url?: string
}

export interface SearchGroup {
	keyword: string
	results: SearchResult[]
}

interface SearchBodyProps {
	keyword?: string
	groups?: SearchGroup[]
}

export default memo(function SearchBody({ keyword, groups = [] }: SearchBodyProps) {
	const { t } = useTranslation("super")

	// Parse HTML to extract text content only
	const parseHTML = useCallback((html: string) => {
		return html.replace(/<[^>]*>?/g, "")
	}, [])

	// Truncate long keywords for display
	const truncateKeyword = useCallback((kw: string, maxLength: number = 30) => {
		if (kw.length <= maxLength) return kw
		return kw.substring(0, maxLength) + "..."
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

			const escapedKeywords = keywords
				.map((word) => {
					try {
						return new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
					} catch {
						return null
					}
				})
				.filter(Boolean)

			return parts
				.map((part, index) => {
					if (part && escapedKeywords.some((re) => re && re.test(part))) {
						return (
							<span
								key={index}
								className="rounded-[2px] bg-[#fff3cd] box-decoration-clone px-0.5 py-px font-bold text-[#212529] [-webkit-box-decoration-break:clone] dark:bg-amber-500/20 dark:text-foreground"
							>
								{part}
							</span>
						)
					}
					return part || ""
				})
				.filter((part) => part !== "")
		} catch (error) {
			console.warn("Regex error in highlightKeywords:", error)
			return text
		}
	}, [])

	// Highlight keyword in search info text
	const highlightSearchKeyword = useCallback((text: string, kw: string) => {
		if (!kw || !text) return text

		try {
			const escapedKeyword = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
			const regex = new RegExp(`(${escapedKeyword})`, "gi")
			const parts = text.split(regex)

			let testRegex: RegExp | null = null
			try {
				testRegex = new RegExp(escapedKeyword, "gi")
			} catch {
				return text
			}

			return parts.map((part, index) => {
				if (part && testRegex && testRegex.test(part)) {
					return (
						<span key={index} className="font-semibold text-foreground">
							{part}
						</span>
					)
				}
				return part || ""
			})
		} catch (error) {
			console.warn("Regex error in highlightSearchKeyword:", error)
			return text
		}
	}, [])

	// Find the current group based on keyword
	const currentGroup = useMemo(() => {
		return groups.find((group) => group.keyword === keyword) || groups[0]
	}, [groups, keyword])

	const results = currentGroup?.results || []
	const totalResults = results.length

	if (!totalResults) return null

	return (
		<div className="flex flex-col gap-2.5 overflow-y-auto p-2.5 max-md:h-[calc(100%-env(safe-area-inset-bottom))]">
			<div
				className="flex h-4 min-w-0 items-center gap-1 text-xs font-normal leading-[1.33] text-muted-foreground"
				title={currentGroup?.keyword || ""}
			>
				<MagicIcon component={IconListSearch} size={14} className="shrink-0" />
				<span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
					{highlightSearchKeyword(
						t("search.searchKeyword", {
							keyword: truncateKeyword(currentGroup?.keyword || ""),
							count: totalResults,
						}),
						truncateKeyword(currentGroup?.keyword || ""),
					)}
				</span>
			</div>
			<div className="flex flex-col">
				{results?.map((item: SearchResult) => {
					const title = parseHTML(item.title)
					const info = parseHTML(item.snippet)
					const itemKeyword = currentGroup?.keyword || ""

					return (
						<div
							key={`search-result-${item.url?.replace(/[^a-zA-Z0-9]/g, "-")}`}
							className="mb-2.5 flex flex-col gap-1 rounded-md bg-fill px-3 py-2.5 last:mb-0"
						>
							<div className="flex min-w-0 flex-1 flex-col gap-1.5">
								<div className="flex items-center gap-2">
									<div className="relative h-4 w-4 shrink-0 overflow-hidden rounded-[2px]">
										<MagicImage
											src={item.icon_url}
											fallback={
												<img
													src={defaultSVG}
													className="absolute rounded-[2px]"
													width={16}
													height={16}
												/>
											}
											className="absolute rounded-[2px]"
											width={16}
											height={16}
										/>
									</div>
									<a
										href={item.url}
										target="_blank"
										rel="noopener noreferrer"
										className="line-clamp-2 hyphens-auto whitespace-normal break-words text-sm font-semibold leading-[1.43] text-foreground no-underline hover:text-primary hover:no-underline"
										title={title}
									>
										{highlightKeywords(title, itemKeyword)}
									</a>
								</div>
								<div className="flex flex-col gap-1">
									<div
										className="line-clamp-2 text-xs font-normal leading-[1.33] text-muted-foreground"
										title={info}
									>
										{highlightKeywords(info, itemKeyword)}
									</div>
									<a
										href={item.url}
										target="_blank"
										rel="noopener noreferrer"
										className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-normal leading-[1.3] text-primary no-underline hover:underline"
										title={item.url}
									>
										{item.url}
									</a>
								</div>
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
})
