import MagicButton from "@/opensource/components/base/MagicButton"
import { Flex, Typography } from "antd"
import { createStyles } from "antd-style"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { svgNode } from "./svgNode"

const useStyles = createStyles(({ css, prefixCls, token }) => ({
	text: css`
		color: ${token.magicColorUsages.text[3]};
		text-align: center;
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
	`,
	button: css`
		margin-bottom: 100px;
		--${prefixCls}-button-padding-inline-lg: 24px !important;
		font-size: 14px;
		font-weight: 600;
		line-height: 20px;
	`,
}))

export default memo(function EmptyNotice() {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	const addNewNotice = useMemoizedFn(() => {
		// FIXME: 需要重新实现
		// extraSectionController?.pushSection({
		// 	key: ExtraSectionKey.NewGroupNotice,
		// 	title: t("chat.groupNotice.postNewNotice"),
		// 	Component: NewGroupNotice,
		// })
	})

	return (
		<Flex vertical justify="center" align="center" gap={12} style={{ height: "100%" }}>
			<Flex vertical align="center" gap={4}>
				{svgNode}
				<Typography.Text className={styles.text}>
					{t("chat.groupNotice.empty")}
				</Typography.Text>
			</Flex>
			<MagicButton
				size="large"
				type="primary"
				className={styles.button}
				onClick={addNewNotice}
			>
				{t("chat.groupNotice.postNewNotice")}
			</MagicButton>
		</Flex>
	)
})
