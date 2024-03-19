import type { NodeProps } from "../../../types"
import { useStyle } from "./styles"
import { Flex } from "antd"
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import {
	downloadFileContent,
	getTemporaryDownloadUrl,
} from "@/opensource/pages/superMagic/utils/api"
import { ChevronUp, ChevronRight, MonitorPlay } from "lucide-react"
import { getLanguageFromFileName } from "../ReadFiles"
import { superMagicStore } from "@/opensource/pages/superMagic/stores"
import { observer } from "mobx-react-lite"
import { defaultOpen } from "../../config"
import { useToolTooltip } from "../../hooks/useToolTooltip"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { isEmpty } from "lodash-es"
import MagicTooltip from "@/opensource/components/base/MagicTooltip"
import { ToolIconBadge } from "@/opensource/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"
import { VerticalLine } from "@/opensource/components/base"

const loadTextEditor = () => {
	return import("@/opensource/pages/superMagic/components/MessageList/components/Tool/components/ToolDetail/TextEditor").then(
		(module) => ({
			default: module.default,
		}),
	)
}

const TextEditor = lazy(() => loadTextEditor())

function WriteFile(props: NodeProps) {
	const { t } = useTranslation("super")
	const { onMouseEnter, onMouseLeave } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const tool = node?.tool
	const fileData = tool?.detail?.data || {}

	const { styles, cx } = useStyle()

	const [open, setOpen] = useState(defaultOpen)
	const [content, setContent] = useState(fileData?.content || "")

	const { tooltipProps, renderTooltip } = useToolTooltip({
		text: fileData?.file_name,
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

	// 点击桌面分享图标，触发打开 playback tab
	const handleOpenPlaybackTab = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation() // 阻止事件冒泡
			if (isEmpty(fileData)) return
			const detail = { ...tool?.detail, id: tool?.id }
			pubsub.publish(PubSubEvents.Open_Playback_Tab, detail)
			props?.onSelectDetail?.({
				...detail,
				isFromNode: true,
			})
		},
		[fileData, props, tool?.detail, tool?.id],
	)

	// 动态计算 suffix 图标：如果有 source_file_id，显示桌面分享图标
	const renderSuffixIcon = useMemo(() => {
		if (tool.status === "error") return null

		if (fileData?.source_file_id) {
			return (
				<>
					<VerticalLine height={28} className="text-input" />
					<MagicTooltip title={t("playbackControl.viewProcess")}>
						<div className={cx(styles.button)} onClick={handleOpenPlaybackTab}>
							<MonitorPlay size={16} className="text-foreground" />
						</div>
					</MagicTooltip>
				</>
			)
		}
		if (!fileData?.file_id) return null

		return (
			<div
				className={cx(styles.button, "mr-[6px]")}
				onClick={() => setOpen((o) => !o)}
				onMouseEnter={() => loadTextEditor()}
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
		)
	}, [
		tool.status,
		fileData?.source_file_id,
		fileData?.file_id,
		handleOpenPlaybackTab,
		styles.button,
		styles.buttonIcon,
		styles.buttonIconActive,
		cx,
		open,
		t,
	])

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
								className={cx(styles.tip, "text-muted-foreground")}
							>
								{tool?.remark}
							</span>
						)}
					</Flex>
					{renderSuffixIcon}
				</div>
				{open && (
					<div className={styles.cardNode}>
						<Suspense fallback={null}>
							<TextEditor
								language={getLanguageFromFileName(fileData?.file_name, extension)}
								content={content}
								fileName={fileData?.file_name}
								extension={extension}
							/>
						</Suspense>
					</div>
				)}
			</div>
			{renderTooltip()}
		</div>
	)
}

export default memo(observer(WriteFile))
