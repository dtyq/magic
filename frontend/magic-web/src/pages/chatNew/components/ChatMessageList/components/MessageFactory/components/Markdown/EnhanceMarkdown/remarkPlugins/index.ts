import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import type { Options as MarkdownOptions } from "react-markdown"
import remarkCitation from "./remarkCitation"

const plugins: Exclude<MarkdownOptions["remarkPlugins"], undefined | null> = [
	[remarkGfm, { singleTilde: false }],
	remarkMath,
	remarkCitation,
]

export default plugins
