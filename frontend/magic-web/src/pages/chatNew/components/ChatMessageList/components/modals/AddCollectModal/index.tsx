import MagicModal from "@/components/base/MagicModal"
import { useTranslation } from "react-i18next"
import { Checkbox, Flex, Select } from "antd"
import { useEffect, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { createStyles } from "antd-style"
import type { CheckboxChangeEvent } from "antd/es/checkbox"
import type { OpenableProps } from "@/utils/react"

export interface AddCollectModalProps {
	msgId: string
}

const originOptions = ["Apple", "Pear", "Orange"]

const useStyles = createStyles(({ css, prefixCls, token }) => {
	return {
		modalHeader: css`
			--${prefixCls}-modal-header-border-bottom: none;
		`,
		modalBody: css`
			--${prefixCls}-modal-body-padding: 0 20px 10px 20px;
    `,
		tagList: css`
			border: 1px solid ${token.magicColorUsages.border};
			width: 100%;
			min-height: 32px;
			border-radius: 8px;
		`,
		collectTip: css`
			color: ${token.magicColorUsages.text[3]};
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			text-align: left;
		`,
		collectTipList: css`
			padding-left: 20px;
		`,
	}
})

export const AddCollectModal = ({
	msgId,
	onClose: _onClose,
	...props
}: OpenableProps<AddCollectModalProps>) => {
	const { t } = useTranslation("interface")
	const [checkedList, setCheckedList] = useState<string[]>([])
	const [open, setOpen] = useState(false)
	const { styles } = useStyles()

	useEffect(() => {
		if (msgId) setOpen(true)
	}, [msgId])

	const onClose = () => {
		setOpen(false)
		_onClose?.()
	}

	const handleOk = useMemoizedFn(() => {
		onClose()
	})
	const handleCancel = useMemoizedFn(() => {
		onClose()
	})

	const onCheckboxChange = (e: CheckboxChangeEvent) => {
		const { checked, value } = e.target
		if (checked) {
			setCheckedList((v) => [...v, value])
		} else {
			setCheckedList((v) => v.filter((item) => item !== value))
		}
	}

	return (
		<MagicModal
			open={open}
			width={320}
			centered
			classNames={{ header: styles.modalHeader, body: styles.modalBody }}
			title={t("chat.collect", { ns: "interface" })}
			okText={t("collectModal.save", { ns: "interface" })}
			onOk={handleOk}
			onCancel={handleCancel}
			onClose={onClose}
			{...props}
		>
			<Flex vertical gap={10}>
				<div className={styles.collectTip}>
					{t("collectModal.tip", { ns: "interface" })}
					<ul className={styles.collectTipList}>
						<li>{t("collectModal.tip1", { ns: "interface" })}</li>
						<li>{t("collectModal.tip2", { ns: "interface" })}</li>
					</ul>
				</div>

				<Select mode="tags" value={checkedList} onChange={setCheckedList} />
				<Flex vertical gap={8}>
					<span>{t("collectModal.selectTip", { ns: "interface" })}</span>
					{originOptions.map((item) => (
						<Checkbox
							value={item}
							checked={checkedList.includes(item)}
							key={item}
							onChange={onCheckboxChange}
						>
							{item}
						</Checkbox>
					))}
				</Flex>
			</Flex>
		</MagicModal>
	)
}

export default AddCollectModal
