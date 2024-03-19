import { Drawer } from "antd"
import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"
import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { ExtraSectionComponentProps } from "@/opensource/pages/chatNew/types"
import EmptyNotice from "./EmptyNotice"

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
	`,
}))

interface ChatSettingProps extends ExtraSectionComponentProps {}

function GroupNotice({ onClose: onCloseInProps }: ChatSettingProps) {
	const [open, setOpen] = useState(true)

	const onClose = useMemoizedFn(() => {
		setOpen(false)
		setTimeout(() => {
			onCloseInProps()
		})
	})

	const { styles } = useStyles()
	const { t } = useTranslation("interface")
	return (
		<Drawer
			open={open}
			closable
			onClose={onClose}
			title={t("chat.groupNotice.title")}
			maskClosable
			mask={false}
			width={576}
			classNames={{
				header: styles.header,
				mask: styles.mask,
				body: styles.body,
			}}
		>
			<EmptyNotice />
		</Drawer>
	)
}

export default GroupNotice
