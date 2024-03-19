import type { ReactNode, HTMLAttributes } from "react"

interface BlockquoteProps extends HTMLAttributes<HTMLQuoteElement> {
	children: ReactNode
}

/**
 * Custom Blockquote component to properly handle nested markdown content
 * Ensures that markdown syntax within blockquotes is correctly parsed and rendered
 *
 * This component preserves the default blockquote behavior while allowing
 * markdown-to-jsx to properly process nested content like code blocks, headers, etc.
 */
function Blockquote({ children, ...props }: BlockquoteProps) {
	return <blockquote {...props}>{children}</blockquote>
}

export default Blockquote
