import type { NodeProps } from "../../../types"
import { useStyle } from "./styles"
import { Flex } from "antd"
import { ChevronUp, ChevronRight } from "lucide-react"
import { memo, useEffect, useMemo, useState } from "react"
import { TextEditor } from "../../../../Tool/components/ToolDetail"
import {
	downloadFileContent,
	getTemporaryDownloadUrl,
} from "@/pages/superMagic/utils/api"
import { observer } from "mobx-react-lite"
import { superMagicStore } from "@/pages/superMagic/stores"
import { defaultOpen } from "../../config"
import { useToolTooltip } from "../../hooks/useToolTooltip"
import { isEmpty } from "lodash-es"
import { ToolIconBadge } from "@/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"

// Determine language from file extension
export const getLanguageFromFileName = (fileName?: string, extension?: string): string => {
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

function ReadFiles(props: NodeProps) {
	const { onMouseEnter, onMouseLeave } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const tool = node?.tool
	const fileData = tool?.detail?.data || {}

	const { styles, cx } = useStyle()

	const [open, setOpen] = useState(defaultOpen)
	const [content, setContent] = useState(fileData?.content || "")

	const { tooltipProps, renderTooltip } = useToolTooltip({
		text: tool?.remark,
		placement: "top",
		checkOverflow: true,
	})

	const extension = useMemo(() => {
		return fileData?.file_name?.split(".").pop()?.toLowerCase()
	}, [fileData?.file_name])

	useEffect(() => {
		if (!content && fileData?.file_id) {
			getTemporaryDownloadUrl({ file_ids: [fileData?.file_id] }).then((res: any) => {
				downloadFileContent(res[0]?.url).then((data: any) => {
					setContent(data)
				})
			})
		}
	}, [content, fileData?.file_id])

	const onClick = () => {
		if (tool.status !== "error") {
			props?.onClick?.()
		}
	}

	return (
		<div className={styles.node} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
			<div className={cx(styles.container, { [styles.containerActive]: open })}>
				<div className={styles.nodeHeader}>
					<Flex
						className={cx(styles.tag, { [styles.tagDisabled]: isEmpty(fileData) })}
						onClick={onClick}
					>
						<ToolIconBadge toolName={tool?.name} />
						<span className={cx(styles.tagLabel, "text-foreground")}>
							{tool?.action}
						</span>
						{!open && (
							<span
								{...tooltipProps}
								className={cx(styles.tip, "text-muted-foreground", {
									"mr-[6px]": tool.status === "error",
								})}
							>
								{tool?.remark || ""}
							</span>
						)}
					</Flex>
					{tool.status !== "error" && (
						<div
							className={cx(styles.button, "mr-[6px]")}
							onClick={() => setOpen((o) => !o)}
						>
							{open ? (
								<ChevronUp
									size={16}
									className={cx(styles.buttonIcon, styles.buttonIconActive)}
								/>
							) : (
								<ChevronRight size={16} className={styles.buttonIcon} />
							)}
						</div>
					)}
				</div>
				{open && (
					<div className={styles.cardNode}>
						<TextEditor
							language={getLanguageFromFileName(fileData?.file_name, extension)}
							content={content}
							fileName={fileData?.file_name}
							extension={extension}
						/>
					</div>
				)}
			</div>
			{renderTooltip()}
		</div>
	)
}

export default memo(observer(ReadFiles))
