import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { useEffect, useState } from "react"
import BaseFlow from "@/pages/flow"
import MagicModal from "@/components/base/MagicModal"
import { useStyles } from "./style"

type FlowModalProps = {
	open: boolean
	/** 通用标识符，可以是 toolCode、agentId、subFlowId 等 */
	id?: string
	onClose: () => void
	/** 当流程发布完成时的回调 */
	onFlowPublished?: () => void
}

function FlowModal({ open, id, onClose, onFlowPublished }: FlowModalProps) {
	const { styles } = useStyles()
	const { t } = useTranslation()
	const [key, setKey] = useState<string>(`flow-modal-${id}-${Date.now()}`)

	// 当打开Modal时重新生成key来强制重新渲染BaseFlow
	useEffect(() => {
		if (open && id) {
			setKey(`flow-modal-${id}-${Date.now()}`)
		}
	}, [open, id])

	// 监听发布完成事件
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			console.log("FlowModal received message:", event.data)
			if (event.data?.type === "FLOW_PUBLISHED") {
				console.log("Flow published, closing modal")
				// 接收到发布成功事件，触发回调并关闭Modal
				onFlowPublished?.()
				onClose()
			}
		}

		if (open) {
			window.addEventListener("message", handleMessage)
			console.log("FlowModal: Added message listener")
		}

		return () => {
			window.removeEventListener("message", handleMessage)
			console.log("FlowModal: Removed message listener")
		}
	}, [open, onFlowPublished, onClose])

	const handleCancel = useMemoizedFn(() => {
		onClose()
	})

	return (
		<MagicModal
			title={t("tools.name", { ns: "flow" })}
			open={open}
			onCancel={handleCancel}
			footer={null}
			width="calc(100vw - 40px)"
			style={{
				height: "calc(100vh - 40px)",
				top: 20,
				left: 20,
				maxWidth: "none",
				margin: 0,
				padding: 0,
			}}
			bodyStyle={{
				height: "calc(100vh - 95px)",
				padding: 0,
				overflow: "hidden",
			}}
			maskClosable={false}
			destroyOnClose
			className={styles.modal}
		>
			{open && id && (
				<div
					key={key}
					style={{
						width: "100%",
						height: "100%",
						overflow: "auto",
					}}
				>
					<BaseFlow
						id={id}
						inModal={true}
						isAgent={false}
						flowType="tools"
						onBack={onClose}
					/>
				</div>
			)}
		</MagicModal>
	)
}

export default FlowModal
