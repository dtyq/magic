import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import { useBoolean, useMemoizedFn } from "ahooks"
import MagicModal from "@/components/base/MagicModal"
import type { OpenableProps } from "@/utils/react"
import MagicButton from "@/components/base/MagicButton"
import { useMemo } from "react"
import magicIcon from "@/assets/logos/magic-avatar.svg"
import { IconKey } from "@tabler/icons-react"
import MagicAvatar from "@/components/base/MagicAvatar"
import { useStyles } from "./styles"
import { ScopeLabel } from "./constant"

// TODO：oauth授权的弹窗，可用于后续的消息授权卡片
interface OAuthModalProps {
	scopes?: string[]
	onSubmit?: () => void
	onClose?: () => void
	closeOAuth: () => void
}

function OAuthModal({
	scopes,
	onSubmit,
	onClose,
	closeOAuth,
	...props
}: OpenableProps<OAuthModalProps>) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("interface")
	const [open, { setFalse }] = useBoolean(true)

	const onCancel = useMemoizedFn(() => {
		setFalse()
		onClose?.()
		closeOAuth()
	})

	const onConfirm = useMemoizedFn(() => {
		onSubmit?.()
		onCancel()
	})

	const footer = useMemoizedFn(() => (
		<Flex align="center" style={{ width: "100%" }} gap={10}>
			<MagicButton onClick={onCancel} type="text" className={cx(styles.button, styles.flex1)}>
				{t("button.reject")}
			</MagicButton>
			<MagicButton onClick={onConfirm} type="primary" className={styles.flex1}>
				{t("button.allow")}
			</MagicButton>
		</Flex>
	))

	const title = useMemo(() => {
		return (
			<Flex align="center" gap={8}>
				<MagicAvatar src={<IconKey size={14} />} size={20} className={styles.icon} />
				{t("oauth.permission")}
			</Flex>
		)
	}, [styles.icon, t])

	return (
		<MagicModal
			className={styles.modal}
			centered
			maskClosable={false}
			open={open}
			onOk={onConfirm}
			onCancel={onCancel}
			width={400}
			destroyOnClose
			footer={footer}
			title={title}
			{...props}
		>
			<Flex vertical gap={14}>
				<Flex align="center" gap={4} className={styles.subTitle}>
					<img width={20} src={magicIcon} alt="magic" />
					{t("oauth.title")}
				</Flex>
				<ul className={styles.desc}>
					{scopes &&
						scopes.map((item) => {
							// @ts-ignore
							return <li key={item}>{ScopeLabel[item]}</li>
						})}
				</ul>
			</Flex>
		</MagicModal>
	)
}

export default OAuthModal
