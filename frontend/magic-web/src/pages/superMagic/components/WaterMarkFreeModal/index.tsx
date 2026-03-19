import { useIsMobile } from "@/hooks/use-mobile"
import CommonPopup from "@/pages/superMagicMobile/components/CommonPopup"
import { Modal } from "antd"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import EditorBody from "../Detail/contents/Md/components/EditorBody"
import agreetment from "./agreetment.md?raw"
import agreetmentEn from "./agreetment_en.md?raw"

export function WaterMarkFreeModal({
	visible,
	onClose,
	onConfirm,
	customPopupProps,
}: {
	visible: boolean
	onClose: () => void
	onConfirm?: () => void | Promise<void>
	customPopupProps?: any
}) {
	const { styles } = useStyles()
	const { i18n, t } = useTranslation("super")
	const isMobile = useIsMobile()
	const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
	const contentRef = useRef<HTMLDivElement>(null)

	// 重置滚动状态
	useEffect(() => {
		if (visible) {
			setHasScrolledToBottom(false)
		}
	}, [visible])

	// 检测是否滚动到底部
	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const target = e.currentTarget
		const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight

		// 当距离底部小于5像素时认为已滚动到底部
		if (distanceFromBottom < 5 && !hasScrolledToBottom) {
			setHasScrolledToBottom(true)
		}
	}

	const handleCancel = () => {
		onClose?.()
	}

	const handleOk = async () => {
		await onConfirm?.()
		onClose?.()
	}

	// 协议内容
	const agreementContent = (
		<div ref={contentRef} onScroll={handleScroll} className={styles.agreementContent}>
			<EditorBody
				isLoading={false}
				viewMode="markdown"
				language="markdown"
				isEditMode={false}
				className={styles.editorBody}
				content={i18n.language === "en_US" ? agreetmentEn : agreetment}
			/>
		</div>
	)

	const modalContent = isMobile ? (
		<CommonPopup
			title={t("waterMarkFree.downloadAgreement")}
			popupProps={{
				visible: visible,
				onClose: () => {
					onClose?.()
				},
				onMaskClick: () => {
					onClose?.()
				},
				...customPopupProps,
			}}
		>
			{agreementContent}
		</CommonPopup>
	) : (
		<Modal
			title={t("waterMarkFree.downloadAgreement")}
			open={visible}
			width={700}
			afterClose={onClose}
			centered
			destroyOnHidden
			keyboard={false}
			maskClosable={false}
			onCancel={handleCancel}
			onOk={handleOk}
			cancelText={t("waterMarkFree.disagree")}
			cancelButtonProps={{
				className: styles.cancelButton,
			}}
			okText={
				hasScrolledToBottom ? t("waterMarkFree.agree") : t("waterMarkFree.readAgreement")
			}
			okButtonProps={{
				disabled: !hasScrolledToBottom,
				className: styles.okButton,
			}}
		>
			{agreementContent}
		</Modal>
	)

	return createPortal(modalContent, document.body)
}
