import { memo, useEffect, useMemo, useState } from "react"
import ToolCard from "../../ToolCard"
import ToolContainer from "../../ToolContainer"
import { TextEditor } from "../../ToolDetail"
import type { BaseToolProps } from "../../../types"
import {
	downloadFileContent,
	getTemporaryDownloadUrl,
} from "@/opensource/pages/superMagic/utils/api"
import { useCollapse } from "../hooks/useCollapse"

interface WriteToFileToolProps extends BaseToolProps {
	detail?: {
		type?: string
		data?: {
			file_id?: string
			file_name?: string
			content?: string
		}
	}
}

function WriteToFileTool(props: WriteToFileToolProps) {
	const { collapsed, setCollapsed, DropdownIcon, collapseCardClassName, expandedCardClassName } =
		useCollapse()

	// Extract file information from the detail structure
	const fileData = props.detail?.data
	const fileName = fileData?.file_name
	const [content, setContent] = useState(fileData?.content || "")

	const extension = useMemo(() => {
		return fileName?.split(".").pop()?.toLowerCase()
	}, [fileName])

	// Determine language from file extension
	const getLanguageFromFileName = (fileName?: string): string => {
		if (!fileName) return "text"

		const languages = [
			"js",
			"jsx",
			"ts",
			"tsx",
			"py",
			"java",
			"cpp",
			"c",
			"css",
			"html",
			"json",
			"xml",
			"md",
			"sql",
			"sh",
			"yml",
			"yaml",
		]
		if (extension && languages.includes(extension)) {
			return extension
		}

		return "markdown"
	}

	useEffect(() => {
		if (!content && fileData?.file_id) {
			getTemporaryDownloadUrl({ file_ids: [fileData?.file_id] }).then((res: any) => {
				downloadFileContent(res[0]?.url).then((data: any) => {
					setContent(data)
				})
			})
		}
	}, [content, fileData?.file_id])

	// 如果折叠，只显示 ToolCard 带 suffix
	if (collapsed) {
		return (
			<ToolContainer>
				<ToolCard
					{...props}
					showRemark
					remark={props.remark}
					suffix={DropdownIcon}
					cardClassName={collapseCardClassName}
				/>
			</ToolContainer>
		)
	}

	// 展开状态显示完整内容
	return (
		<ToolContainer withDetail>
			<ToolCard
				{...props}
				showRemark={false}
				remark={props.remark}
				suffix={DropdownIcon}
				cardClassName={expandedCardClassName}
			/>
			<TextEditor
				content={content}
				fileName={fileName}
				language={getLanguageFromFileName(fileName)}
				extension={extension}
			/>
		</ToolContainer>
	)
}

export default memo(WriteToFileTool)
