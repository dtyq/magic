import { MagicFlow } from "@/index"
import { Modal } from "antd"
import { IconChevronLeft } from "@tabler/icons-react"
import clsx from "clsx"
import React, { useMemo } from "react"
import { prefix } from "../constants"
import styles from "./index.module.less"

export default function MagicFlowModal({ ...props }) {
	const backIcon = useMemo(() => {
		return (
			<IconChevronLeft
				size={32}
				stroke={2}
				color="#000000"
				className={clsx(styles.iconBack, `${prefix}icon-back`)}
				onClick={props?.onClose || (() => {})}
			/>
		)
	}, [])

	return (
		<Modal
			title={null}
			footer={null}
			open={props.open}
			width="100%"
			// @ts-ignore
			height="100%"
			wrapClassName={clsx(styles.magicFlowModal, `${prefix}modal`)}
			destroyOnClose
		>
			<MagicFlow {...props} header={{ ...(props.header || {}), backIcon }} />
		</Modal>
	)
}
