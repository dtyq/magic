import type { ClassAttributes, FC, HTMLAttributes } from "react"
import { Suspense, useMemo } from "react"
import { unescape } from "lodash-es"
import type { ExtraProps } from "react-markdown"
import { useIsStreaming } from "@/opensource/hooks/useIsStreaming"
import { CodeLanguage } from "./const"
import type { MarkdownProps } from "../../types"
import CodeRenderFactory from "../../factories/CodeRenderFactory"
import { Skeleton } from "antd"

const Code: FC<
	ClassAttributes<HTMLElement> &
		HTMLAttributes<HTMLElement> &
		ExtraProps & {
			markdownProps?: MarkdownProps
		}
> = (props) => {
	const { className, children = "", markdownProps } = props

	const lang = useMemo(() => {
		try {
			const match = /lang-(.*)/.exec(className || "")
			return match && match[1]
		} catch (error) {
			console.error(error)
			return undefined
		}
	}, [className])

	const { isStreaming } = useIsStreaming(children as string)
	const CodeComponent = CodeRenderFactory.getComponent(lang as CodeLanguage)

	return (
		<Suspense fallback={<Skeleton.Input active />}>
			<CodeComponent
				language={lang as CodeLanguage}
				data={unescape(unescape(unescape(children as string)) as string)}
				isStreaming={isStreaming || markdownProps?.isStreaming}
			/>
		</Suspense>
	)
}

export default Code
