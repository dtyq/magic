import type { NodeProps } from "../../../types"
import { useStyle } from "./styles"
import { Flex, Tooltip } from "antd"
import { superMagicStore } from "@/opensource/pages/superMagic/stores"
import { memo, useCallback, useMemo } from "react"
import { observer } from "mobx-react-lite"
import { useToolTooltip } from "../../hooks/useToolTooltip"
import { isEmpty } from "lodash-es"
import { VerticalLine } from "@/opensource/components/base"
import { useTranslation } from "react-i18next"
import { ToolIconBadge } from "@/opensource/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"
import { MonitorPlay } from "lucide-react"

function ReadWebAsMarkdown(props: NodeProps) {
	const { onMouseEnter, onMouseLeave } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const tool = node?.tool

	const { t } = useTranslation("super")
	const { styles, cx } = useStyle()

	const { tooltipProps, renderTooltip } = useToolTooltip({
		text: tool?.remark,
		placement: "top",
		checkOverflow: true,
	})

	const onClick = useCallback(() => {
		if (tool.status !== "error") {
			props?.onClick?.()
		}
	}, [tool.status, props])

	// 动态计算 suffix 图标：如果有 source_file_id，显示桌面分享图标，否则返回 null
	const renderSuffixIcon = useMemo(() => {
		if (tool.status === "error") return null

		if (isEmpty(tool?.detail?.data)) return null

		return (
			<>
				<VerticalLine height={28} className="text-input" />
				<Tooltip title={t("playbackControl.viewProcess")}>
					<div className={cx(styles.button)} onClick={onClick}>
						<MonitorPlay size={16} className="text-foreground" />
					</div>
				</Tooltip>
			</>
		)
	}, [tool.status, tool?.detail?.data, t, styles.button, onClick, cx])

	return (
		<div
			className={styles.node}
			data-id={props?.node?.app_message_id}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<div className={styles.container}>
				<Flex
					className={cx(styles.tag, { [styles.tagDisabled]: isEmpty(tool?.detail) })}
					onClick={onClick}
				>
					<ToolIconBadge toolName={tool?.name} />
					<span className={cx(styles.tagLabel, "text-foreground")}>{tool?.action}</span>
					<span {...tooltipProps} className={cx(styles.tip, "text-muted-foreground")}>
						{tool?.remark || ""}
					</span>
				</Flex>
				{renderSuffixIcon}
			</div>
			{renderTooltip()}
		</div>
	)
}

export default memo(observer(ReadWebAsMarkdown))
