import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import MagicModal from "@/opensource/components/base/MagicModal"
import { IconUserPlus } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import type { ModalProps } from "antd"
import { Checkbox, DatePicker, Flex, Form, Input, Segmented } from "antd"
import { createStyles, cx } from "antd-style"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

const enum SendType {
	OnlyApp = "onlyApp",
	AppAndMessage = "appAndMessage",
	AppAndPhone = "appAndPhone",
}

interface UrgentModalProps extends ModalProps {
	msgId: string
	onClose?: () => void
}

const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		body: css`
			--${prefixCls}-modal-body-padding: 0;
		`,
		segmented: css`
			--${prefixCls}-segmented-item-selected-color: ${token.colorPrimary} !important;
      --magic-control-padding-horizontal: 18px;
			.${prefixCls}-segmented-item-selected .${prefixCls}-segmented-item-label {
				font-weight: 600;
			}
		`,
		textarea: css`
			background: transparent;
			border: 0;
			&:hover,
			&:focus {
				background: transparent;
				border: 0;
			}
      height: 200px;
			--${prefixCls}-input-active-shadow: none;
		`,
		addBtn: css`
			background: transparent;
      border-color: ${token.colorPrimary};
			--${prefixCls}-button-padding-inline: 10px !important;
      border-radius: 8px;
      height: 32px;
      gap: 4px;

      overflow: hidden;
			text-overflow: ellipsis;
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;

			&:hover {
				--${prefixCls}-button-default-hover-bg: rgba(46, 47, 56, 0.03);
			}
		`,
		contentFormItem: css`
			padding: 0;
			background-color: ${token.magicColorScales.grey[0]};
		`,
		formItem: css`
			border-bottom: 1px solid ${token.colorBorder};
			padding: 12px;
			margin-bottom: 0;

			.${prefixCls}-form-item-label {
				width: 100px;
				text-align: left;

				> label::after {
					content: "";
				}
			}
		`,
		footer: css`
			--${prefixCls}-modal-footer-padding: 12px;
		`,
	}
})

function UrgentModal({ onClose: _onClose }: UrgentModalProps) {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	const sendTypeOptions = useMemo(() => {
		return [
			{
				label: t("chat.urgentModal.sendType.onlyApp"),
				value: SendType.OnlyApp,
			},
			{
				label: t("chat.urgentModal.sendType.appAndMessage"),
				value: SendType.AppAndMessage,
			},
			{
				label: t("chat.urgentModal.sendType.appAndPhone"),
				value: SendType.AppAndPhone,
			},
		]
	}, [t])

	const [open, setOpen] = useState(true)
	const [timedTransmissionOpen, setTimedTransmissionOpen] = useState(false)
	const onClose = useMemoizedFn(() => {
		setOpen(false)
		_onClose?.()
	})

	const onOk = useMemoizedFn(() => {
		onClose()
	})
	const onCancel = useMemoizedFn(() => {
		onClose()
	})

	return (
		<MagicModal
			title={t("chat.urgentModal.title")}
			open={open}
			onOk={onOk}
			width={400}
			onCancel={onCancel}
			classNames={{
				body: styles.body,
				footer: styles.footer,
			}}
		>
			<Form>
				<Form.Item
					className={cx(styles.formItem, styles.contentFormItem)}
					label=""
					name="content"
				>
					<Input.TextArea className={styles.textarea} />
				</Form.Item>
				<Form.Item
					className={styles.formItem}
					label={t("chat.urgentModal.form.sendType")}
					name="sendType"
				>
					<Segmented className={styles.segmented} options={sendTypeOptions} />
				</Form.Item>
				<Form.Item
					className={styles.formItem}
					label={t("chat.urgentModal.form.recipient")}
					name="recipient"
				>
					<MagicButton
						type="default"
						className={styles.addBtn}
						icon={
							<MagicIcon
								color="currentColor"
								size={18}
								stroke={2}
								component={IconUserPlus}
							/>
						}
					>
						{t("button.add")}
					</MagicButton>
				</Form.Item>
				<Form.Item
					className={styles.formItem}
					label={
						<Flex align="center" gap={8}>
							<Checkbox
								checked={timedTransmissionOpen}
								onChange={(e) => setTimedTransmissionOpen(e.target.checked)}
							/>
							{t("chat.urgentModal.form.timedTransmission")}
						</Flex>
					}
					name="timedTransmission"
				>
					<DatePicker
						placeholder={t("chat.urgentModal.form.timedTransmissionOpenPlaceholder")}
						disabled={!timedTransmissionOpen}
						showTime
					/>
				</Form.Item>
			</Form>
		</MagicModal>
	)
}

export default UrgentModal
