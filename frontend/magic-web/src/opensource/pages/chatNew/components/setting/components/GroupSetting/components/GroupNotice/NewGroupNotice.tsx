import MagicButton from "@/opensource/components/base/MagicButton"
import MagicRichEditor from "@/opensource/components/base/MagicRichEditor"
import type { ExtraSectionComponentProps } from "@/opensource/pages/chatNew/types"
import { useMemoizedFn } from "ahooks"
import { Drawer, Flex } from "antd"
import { createStyles } from "antd-style"
import { useState } from "react"
import { useTranslation } from "react-i18next"

const useStyles = createStyles(({ prefixCls, css, isDarkMode, token }) => ({
	header: css`
		--${prefixCls}-padding: 12px;
		--${prefixCls}-padding-lg: 12px;
		.${prefixCls}-drawer-header-title {
			flex-direction: row-reverse;
		}

    .${prefixCls}-drawer-close {
      margin-right: 0;
    }
	`,
	icon: css`
		background-color: ${token.magicColorScales.green[5]};
		color: white;
		border-radius: 4px;
		padding: 4px;
	`,
	mask: css`
		--${prefixCls}-color-bg-mask: transparent;
	`,
	body: css`
		background-color: ${isDarkMode ? "#141414" : token.colorWhite};
		--${prefixCls}-padding-lg: 12px;
		height: 100%;
	`,
	container: css`
		height: 100%;
	`,
	editor: css`
		flex: 1;
	`,
	footer: css`
		padding-top: 10px;
		border-top: 1px solid ${token.colorBorderSecondary};
	`,
}))

export default function NewGroupNotice({ onClose: onCloseInProps }: ExtraSectionComponentProps) {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	const [open, setOpen] = useState(true)
	const onClose = useMemoizedFn(() => {
		setOpen(false)
		onCloseInProps()
	})

	return (
		<Drawer
			open={open}
			closable
			onClose={onClose}
			title={t("chat.groupNotice.title")}
			maskClosable={false}
			mask={false}
			width={576}
			classNames={{
				header: styles.header,
				mask: styles.mask,
				body: styles.body,
			}}
		>
			<Flex vertical gap={10} className={styles.container}>
				<MagicRichEditor
					className={styles.editor}
					placeholder={t("chat.groupNotice.placeholder")}
				/>
				<Flex justify="end" align="center" gap={10} className={styles.footer}>
					<MagicButton size="large" type="default" onClick={onClose}>
						取消
					</MagicButton>
					<MagicButton size="large" type="primary" onClick={onClose}>
						下一步
					</MagicButton>
				</Flex>
			</Flex>
		</Drawer>
	)
}
