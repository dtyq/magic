import { Suspense, lazy, memo } from "react"
import { useStyles } from "./styles"
import ToolDetailContainer from "../ToolDetailContainer"

const EditorBody = lazy(
	() =>
		import("@/opensource/pages/superMagic/components/Detail/contents/Md/components/EditorBody"),
)
const IsolatedHTMLRenderer = lazy(
	() =>
		import("@/opensource/pages/superMagic/components/Detail/contents/HTML/IsolatedHTMLRenderer"),
)

interface TextEditorProps {
	content: string
	language?: string
	extension?: string
	fileName?: string
}

function TextEditor({ content, language = "markdown", extension, fileName }: TextEditorProps) {
	const { styles } = useStyles()

	return (
		<ToolDetailContainer extension={extension} title={fileName}>
			<Suspense fallback={null}>
				{extension === "html" ? (
					<IsolatedHTMLRenderer
						content={content}
						sandboxType="iframe"
						isPptRender={false}
						filePathMapping={new Map()}
						openNewTab={() => {}}
					/>
				) : (
					<EditorBody
						isLoading={false}
						viewMode={extension === "md" ? "markdown" : "code"}
						language={language}
						className={extension === "md" ? styles.editorBody : ""}
						content={content}
						isEditMode={false}
					/>
				)}
			</Suspense>
		</ToolDetailContainer>
	)
}

export default memo(TextEditor)
