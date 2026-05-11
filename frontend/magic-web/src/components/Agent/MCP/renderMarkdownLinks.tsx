import type { ReactNode } from "react"
import { IconLink } from "@tabler/icons-react"

interface RenderMarkdownLinksOptions {
	linkClassName: string
	linkTestId?: string
	iconSize?: number
}

const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g

export const renderMarkdownLinks = (
	text: string,
	{ linkClassName, linkTestId, iconSize = 12 }: RenderMarkdownLinksOptions,
): ReactNode[] => {
	const matches = Array.from(text.matchAll(markdownLinkRegex))

	if (matches.length === 0) {
		return [text]
	}

	const nodes: ReactNode[] = []
	let lastIndex = 0

	matches.forEach((match, index) => {
		const [fullMatch, label, href] = match
		const startIndex = match.index ?? 0
		const endIndex = startIndex + fullMatch.length

		if (startIndex > lastIndex) {
			nodes.push(text.slice(lastIndex, startIndex))
		}

		nodes.push(
			<a
				key={`${href}-${label}-${index}`}
				href={href}
				className={`inline-flex items-center gap-1 ${linkClassName}`}
				target="_blank"
				rel="noreferrer"
				data-testid={linkTestId}
			>
				<IconLink size={iconSize} className="shrink-0" aria-hidden="true" />
				{label}
			</a>,
		)

		lastIndex = endIndex
	})

	if (lastIndex < text.length) {
		nodes.push(text.slice(lastIndex))
	}

	return nodes
}
