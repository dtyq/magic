import { Form, Flex, Popover, Tooltip } from "antd"
import type React from "react"
import { forwardRef, useImperativeHandle, useMemo, useState } from "react"
import type { UseableToolSet } from "@/types/flow"
import { IconX } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { useFlowStore } from "@/opensource/stores/flow"
import { FlowApi } from "@/apis"
import styles from "./index.module.less"
import JSONSchemaRenderer from "@/opensource/pages/flow/components/JSONSchemaRenderer"

type ToolAddableCardPopoverProps = React.PropsWithChildren<{
	tool: UseableToolSet.UsableTool
	avatar: string
}>

export type ToolAddableCardPopoverRef = {
	setVisible: React.Dispatch<React.SetStateAction<boolean>>
}

const ToolAddableCardPopover = forwardRef<ToolAddableCardPopoverRef, ToolAddableCardPopoverProps>(
	(props, ref) => {
		const { t } = useTranslation()
		const { updateToolInputOutputMap, toolInputOutputMap } = useFlowStore()
		const { avatar, tool, children } = props
		const [visible, setVisible] = useState(false)

		const handlePopoverToggle = useMemoizedFn((open: boolean) => {
			setVisible(open)

			if (open && !toolInputOutputMap?.[tool.code]) {
				// 更新inputOutput的map
				FlowApi.getAvailableTools([tool.code]).then((response) => {
					if (response.list.length > 0) {
						const targetTool = response.list[0]
						updateToolInputOutputMap({
							...toolInputOutputMap,
							[tool.code]: targetTool,
						})
					}
				})
			}
		})

		useImperativeHandle(ref, () => {
			return {
				setVisible,
			}
		})

		const PopContent = useMemo(() => {
			return (
				<Form
					className={styles.popContent}
					layout="vertical"
					onClick={(e) => e.stopPropagation()}
				>
					<Flex align="center" justify="space-between" className={styles.header}>
						<img src={avatar} alt="" className={styles.avatar} />
						<div className={styles.titleWrap}>
							<Tooltip title={tool?.name}>
								<div className={styles.title}>{tool?.name}</div>
							</Tooltip>
						</div>
						<IconX size={24} color="#1C1D23CC" />
					</Flex>
					<span className={styles.toolDesc}>{tool?.description}</span>
					<Form.Item
						label={t("common.inputArguments", { ns: "flow" })}
						style={{ marginTop: "10px" }}
					>
						<JSONSchemaRenderer form={tool?.input?.form?.structure} />
					</Form.Item>
					<Form.Item label={t("common.outputArguments", { ns: "flow" })}>
						<JSONSchemaRenderer form={tool?.output?.form?.structure} />
					</Form.Item>
				</Form>
			)
		}, [
			avatar,
			t,
			tool?.description,
			tool?.input?.form?.structure,
			tool?.name,
			tool?.output?.form?.structure,
		])

		return (
			<Popover
				content={PopContent}
				placement="left"
				trigger="hover"
				onOpenChange={handlePopoverToggle}
				open={visible}
			>
				{children}
			</Popover>
		)
	},
)

export default ToolAddableCardPopover
