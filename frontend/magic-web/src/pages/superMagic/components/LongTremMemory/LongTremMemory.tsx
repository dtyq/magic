import { Flex } from "antd"
import { IconBrain, IconX } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import type { AgentCommonModalChildrenProps } from "@/components/Agent/AgentCommonModal/types"
import { useIsMobile } from "@/hooks/useIsMobile"
import { GlobalMemoryEditor } from "./components/GlobalMemoryEditor"
import { LongTermMemoryFeatureSwitch } from "./components/LongTermMemoryFeatureSwitch"
import { useStyles } from "./styles"

export type LongTremMemoryProps = AgentCommonModalChildrenProps

/** 个人中心长期记忆弹窗，只展示和编辑全局 MEMORY.md。 */
export default function LongTremMemory(props: LongTremMemoryProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("super/longMemory")
	const isMobile = useIsMobile()

	/** 关闭长期记忆弹窗。 */
	const handleClose = useMemoizedFn(() => {
		props.onClose?.()
	})

	return (
		<div className={styles.layout}>
			{!isMobile && (
				<div className={styles.main}>
					<div className={styles.header}>
						<Flex gap={8} align="center">
							<div className={styles.icon}>
								<IconBrain size={24} />
							</div>
							<div>{t("longMemory")}</div>
						</Flex>
						<div
							className={styles.close}
							onClick={handleClose}
							data-testid="handle-close"
						>
							<IconX size={24} />
						</div>
					</div>
				</div>
			)}
			<LongTermMemoryFeatureSwitch />
			<GlobalMemoryEditor />
		</div>
	)
}
