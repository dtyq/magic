import { prefix } from "@/MagicFlow/constants"
import { MagicFlow } from "@/MagicFlow/types/flow"
import { IconUploadError } from "@douyinfe/semi-icons"
import { Flex, Popconfirm } from "antd"
import { IconCopy, IconTrash } from "@tabler/icons-react"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import clsx from "clsx"
import i18next from "i18next"
import React from "react"
import { useTranslation } from "react-i18next"
import { Edge, useKeyPress } from "reactflow"
import { useFlowInteractionActions } from "../../context/FlowInteraction/useFlowInteraction"
import styles from "./index.module.less"

type SelectionToolsProps = {
	show: boolean
	setShow: React.Dispatch<React.SetStateAction<boolean>>
	selectionNodes: MagicFlow.Node[]
	selectionEdges: Edge[]
	onCopy: () => void
}

export default function SelectionTools({
	show,
	setShow,
	selectionNodes,
	onCopy,
}: SelectionToolsProps) {
	const { t } = useTranslation()
	const { onNodesDelete } = useFlowInteractionActions()

	const onDelete = useMemoizedFn(() => {
		onNodesDelete(selectionNodes)
		setShow(false)
	})

	const DeleteKey = useKeyPress(["Backspace", "Delete"])

	useUpdateEffect(() => {
		if (DeleteKey && selectionNodes && selectionNodes.length > 1) {
			onDelete()
		}
	}, [DeleteKey])

	return show ? (
		<Flex className={clsx(styles.groupWrap, `${prefix}group-wrap`)}>
			<div className={clsx(styles.controlItem, `${prefix}control-item`)} onClick={onCopy}>
				<IconCopy stroke={1} />
				{i18next.t("common.copy", { ns: "magicFlow" })}
			</div>
			<svg className={clsx(styles.line, `${prefix}line`)}>
				<line x1={0} y1={0} x2={0} y2={20} stroke="#1C1D2314" strokeWidth="1" />
			</svg>
			<Popconfirm
				title={i18next.t("flow.confirm2DeleteNodes", { ns: "magicFlow" })}
				onConfirm={() => onDelete()}
				icon={<IconUploadError style={{ color: "rgb(255, 24, 9)" }} />}
				okButtonProps={{ danger: true }}
				okText={i18next.t("common.confirm", { ns: "magicFlow" })}
				cancelText={i18next.t("common.cancel", { ns: "magicFlow" })}
			>
				{/* @ts-ignore */}
				<div className={clsx(styles.controlItem, `${prefix}control-item`)}>
					<IconTrash stroke={1} />
					{i18next.t("common.delete", { ns: "magicFlow" })}
				</div>
			</Popconfirm>
		</Flex>
	) : null
}
