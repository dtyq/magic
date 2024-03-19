import { useFlowInteractionActions } from "@/MagicFlow/components/FlowDesign/context/FlowInteraction/useFlowInteraction"
import { useFlowNodes } from "@/MagicFlow/context/FlowContext/useFlow"
import { IconUploadError } from "@douyinfe/semi-icons"
import { Button, Popconfirm, Tooltip } from "antd"
import { IconCopy, IconTrash } from "@tabler/icons-react"
import { useUpdateEffect } from "ahooks"
import i18next from "i18next"
import { isFunction } from "lodash"
import React, { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useKeyPress } from "reactflow"
import styles from "./index.module.less"
import useToolbar from "./useToolbar"

type ToolbarComponentProps = {
	id: string
	showCopy?: boolean
}

export default function ToolbarComponent({ id, showCopy = true }: ToolbarComponentProps) {
	const { t } = useTranslation()
	const { pasteNode, deleteNode } = useToolbar()
	const { selectedNodeId } = useFlowNodes()

	const { setShowSelectionTools } = useFlowInteractionActions()

	const trashRef = useRef<HTMLElement>()

	// 跟踪确认对话框是否打开
	const [isPopconfirmVisible, setIsPopconfirmVisible] = useState(false)

	const ToolbarItems = useMemo(() => {
		let resultItems = [
			{
				icon: (
					<Popconfirm
						title={i18next.t("flow.confirm2DeleteNode", { ns: "magicFlow" })}
						onConfirm={() => deleteNode(id)}
						onOpenChange={(visible) => setIsPopconfirmVisible(visible)}
						icon={<IconUploadError style={{ color: "rgb(255, 24, 9)" }} />}
						okButtonProps={{ danger: true }}
						okText={i18next.t("common.confirm", { ns: "magicFlow" })}
						cancelText={i18next.t("common.cancel", { ns: "magicFlow" })}
						rootClassName={styles.popconfirm}
					>
						{/* @ts-ignore */}
						<Button type="link" ref={trashRef} className={styles.deleteBtn}>
							<IconTrash stroke={1} />
						</Button>
					</Popconfirm>
				),
				tooltip: i18next.t("common.delete", { ns: "magicFlow" }),
				callback: () => {},
			},
		]

		if (showCopy) {
			resultItems.push({
				icon: <IconCopy stroke={1} />,
				tooltip: i18next.t("common.copy", { ns: "magicFlow" }),
				callback: () => pasteNode(id),
			})
		}

		return resultItems
	}, [deleteNode, id, pasteNode])

	const DeleteKey = useKeyPress(["Backspace", "Delete"])
	const EnterKey = useKeyPress(["Enter"])

	useUpdateEffect(() => {
		console.log(DeleteKey, selectedNodeId, EnterKey, isPopconfirmVisible)
		if (DeleteKey && selectedNodeId) {
			// 只在未打开确认对话框的情况下点击删除按钮
			trashRef?.current?.click()
		}
		// 当按下 Enter 键且确认对话框打开时，触发删除节点操作
		if (EnterKey && isPopconfirmVisible && selectedNodeId) {
			deleteNode(selectedNodeId)
			setIsPopconfirmVisible(false)
		}
	}, [DeleteKey, EnterKey])

	return (
		<div className={styles.toolbarWrapper}>
			{ToolbarItems.map((item, i) => {
				return (
					<Tooltip
						title={item.tooltip}
						key={i}
						// @ts-ignore
						onClick={() => {
							setShowSelectionTools(false)
							item?.callback?.()
						}}
					>
						{isFunction(item.icon) ? item.icon() : item.icon}
					</Tooltip>
				)
			})}
		</div>
	)
}
