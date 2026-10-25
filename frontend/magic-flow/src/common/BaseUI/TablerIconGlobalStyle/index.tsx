import { createGlobalStyle } from "styled-components"

/**
 * Keep Tabler icons in the surrounding text/flex flow even when the host
 * application applies a global `svg { display: block }` reset.
 */
const TablerIconGlobalStyle = createGlobalStyle`
	.tabler-icon {
		display: inline-block;
		vertical-align: middle;
		flex-shrink: 0;
	}
`

export default TablerIconGlobalStyle
