import { forwardRef, useImperativeHandle, useState, type PropsWithChildren } from "react"
import { Modal } from "antd"
import { createStyles } from "antd-style"
import { useMount, useMemoizedFn } from "ahooks"
import { Popup } from "antd-mobile"
import SettingPanel from "./SettingPanel"
import { useIsMobile } from "@/hooks/use-mobile"
import { SettingPanelModalRef, SettingPanelModalProps } from "./types"

const useStyles = createStyles(({ css, prefixCls }) => {
	return {
		modal: css`
			.${prefixCls}-modal-content {
				padding: 0;
				overflow: hidden;
			}

			.${prefixCls}-modal-body {
				padding: 0;
				height: 600px;
			}
		`,
		mobilePopup: css`
			height: 85vh;
			overflow: hidden;
		`,
	}
})

export const SettingPanelModal = forwardRef<
	SettingPanelModalRef,
	PropsWithChildren<SettingPanelModalProps>
>((props, ref) => {
	const { menuItems, renderContent, defaultActiveKey, onClose, width = 900, height = 600 } = props

	const { styles } = useStyles()
	const isMobile = useIsMobile()

	const [open, setOpen] = useState(false)
	const [activeKey, setActiveKey] = useState(defaultActiveKey || menuItems[0]?.key || "")

	useMount(() => {
		setTimeout(() => {
			setOpen(true)
		}, 100)
	})

	const handleClose = useMemoizedFn(() => {
		setOpen(false)
	})

	const handleAfterClose = useMemoizedFn(() => {
		onClose?.()
	})

	useImperativeHandle(ref, () => ({
		close() {
			setOpen(false)
		},
		setActiveKey(key: string) {
			setActiveKey(key)
		},
	}))

	const content = (
		<SettingPanel
			menuItems={menuItems}
			activeKey={activeKey}
			onActiveKeyChange={setActiveKey}
			renderContent={renderContent}
			onClose={handleClose}
			style={{ height: isMobile ? "100%" : height }}
		/>
	)

	if (isMobile) {
		return (
			<Popup
				visible={open}
				onMaskClick={handleClose}
				onClose={handleClose}
				afterClose={handleAfterClose}
				bodyClassName={styles.mobilePopup}
				bodyStyle={{
					borderTopLeftRadius: "12px",
					borderTopRightRadius: "12px",
					overflow: "hidden",
					padding: 0,
				}}
			>
				{content}
			</Popup>
		)
	}

	return (
		<Modal
			centered
			open={open}
			onCancel={handleClose}
			afterClose={handleAfterClose}
			closable={false}
			footer={null}
			width={width}
			className={styles.modal}
			maskClosable={false}
		>
			{content}
		</Modal>
	)
})
