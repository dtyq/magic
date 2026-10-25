declare module "react-syntax-highlighter" {
	import type { ComponentType, CSSProperties, HTMLProps, JSX, ReactNode } from "react"

	export interface SyntaxHighlighterProps {
		language?: string
		style?: Record<string, CSSProperties>
		children: string | string[]
		customStyle?: CSSProperties
		codeTagProps?: HTMLProps<HTMLElement>
		useInlineStyles?: boolean
		showLineNumbers?: boolean
		showInlineLineNumbers?: boolean
		startingLineNumber?: number
		lineNumberContainerStyle?: CSSProperties
		lineNumberStyle?: CSSProperties | ((lineNumber: number) => CSSProperties)
		wrapLines?: boolean
		wrapLongLines?: boolean
		lineProps?: HTMLProps<HTMLElement> | ((lineNumber: number) => HTMLProps<HTMLElement>)
		renderer?: (props: {
			rows: unknown[]
			stylesheet: Record<string, CSSProperties>
			useInlineStyles: boolean
		}) => ReactNode
		PreTag?: keyof JSX.IntrinsicElements | ComponentType<unknown>
		CodeTag?: keyof JSX.IntrinsicElements | ComponentType<unknown>
		[key: string]: unknown
	}
}

declare module "react-syntax-highlighter/dist/esm/light" {
	import type { ComponentType } from "react"
	import type { SyntaxHighlighterProps } from "react-syntax-highlighter"

	const Light: ComponentType<SyntaxHighlighterProps> & {
		registerLanguage(name: string, grammar: unknown): void
	}
	export default Light
}

declare module "react-syntax-highlighter/dist/esm/prism-light" {
	import type { ComponentType } from "react"
	import type { SyntaxHighlighterProps } from "react-syntax-highlighter"

	const PrismLight: ComponentType<SyntaxHighlighterProps> & {
		registerLanguage(name: string, grammar: unknown): void
		alias(name: string, aliases: string | string[]): void
		alias(aliases: Record<string, string | string[]>): void
	}
	export default PrismLight
}

declare module "react-syntax-highlighter/dist/esm/languages/hljs/*" {
	const grammar: unknown
	export default grammar
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/*" {
	const grammar: unknown
	export default grammar
}

declare module "react-syntax-highlighter/dist/esm/styles/hljs/*" {
	import type { CSSProperties } from "react"

	const style: Record<string, CSSProperties>
	export default style
}
