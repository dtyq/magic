import type { MermaidConfig } from "mermaid"

/**
 * mdx-mermaid config
 */
export type Config = {
	/**
	 * Theme to use.
	 *
	 * For available themes, see: https://github.com/mermaid-js/mermaid/blob/develop/src/themes/index.js.
	 *
	 * If set, this `theme` member overrides anything set by `mermaid.theme`.
	 */
	theme?: {
		/**
		 * Theme to use when HTML data theme is 'light'.
		 *
		 * Defaults to `DEFAULT_LIGHT_THEME`.
		 */
		light: string

		/**
		 * Theme to use when HTML data theme is 'dark'.
		 *
		 * Defaults to `DEFAULT_DARK_THEME`.
		 */
		dark: string
	}

	/**
	 * Mermaid configuration.
	 */
	mermaid?: MermaidConfig

	/**
	 * What format to output into the mdast tree as.
	 *
	 * ast - ast format where a `Mermaid` component must be supplied in the parser.
	 * svg - Converts the diagram to a jsx component that renders the svg.
	 *
	 * @default 'ast'
	 */
	output?: "ast" | "svg"

	/**
	 * URL to the mermaid build to use in the svg render.
	 *
	 * Default is: https://cdn.jsdelivr.net/npm/mermaid@9.3.0/dist/mermaid.min.js
	 */
	svgMermaidSrc?: string
}
