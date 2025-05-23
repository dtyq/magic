import { findAndReplace } from "mdast-util-find-and-replace"

export const CitationRegexes = [
	/\[\[citation:(\d+)\]\]/g,
	/\[\[citation(\d+)\]\]/g,
	/\[citation:(\d+)\]/g,
	/\[citation(\d+)\]/g,
]

export default function remarkCitation() {
	return (tree: any) => {
		CitationRegexes.forEach((regex) => {
			findAndReplace(tree, [
				regex,
				(_: string, $1: any) => {
					return {
						type: "footnoteReference",
						identifier: $1,
					}
				},
			])
		})
	}
}
