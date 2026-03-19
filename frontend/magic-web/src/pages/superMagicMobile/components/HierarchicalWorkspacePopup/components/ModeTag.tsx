import { memo, useMemo } from "react"
import { createStyles } from "antd-style"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/types"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { computed } from "mobx"
import { useTranslation } from "react-i18next"
import MagicIcon from "@/components/base/MagicIcon"
import { IconMessageCircleQuestion } from "@tabler/icons-react"
import IconComponent from "@/pages/superMagic/components/IconViewComponent/index"

const useStyles = createStyles(({ css, token }) => ({
	modeTag: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 4px;
		// border: 1px solid;

		&.invalid {
			background: ${token.magicColorScales.grey[0]};
			border-color: ${token.magicColorUsages.border};
		}

		// /* 通用模式 */
		// &.general {
		// 	background: ${token.magicColorScales.brand[0]};
		// 	border-color: ${token.magicColorScales.brand[1]};

		// 	svg {
		// 		color: ${token.magicColorScales.brand[4]};
		// 	}
		// }

		// /* 数据分析 */
		// &.data_analysis {
		// 	background: ${token.magicColorScales.green[0]};
		// 	border-color: ${token.magicColorScales.green[1]};

		// 	svg {
		// 		stroke: ${token.magicColorScales.green[4]};
		// 	}
		// }

		// /* PPT模式 */
		// &.ppt {
		// 	background: ${token.magicColorScales.orange[0]};
		// 	border-color: ${token.magicColorScales.orange[1]};

		// 	svg {
		// 		stroke: ${token.magicColorScales.orange[4]};
		// 	}
		// }

		// /* 研报模式 */
		// &.summary {
		// 	background: ${token.magicColorScales.teal[0]};
		// 	border-color: ${token.magicColorScales.teal[1]};

		// 	svg {
		// 		stroke: ${token.magicColorScales.teal[4]};
		// 	}
		// }

		// /* 会议模式/录音总结 */
		// &.meeting {
		// 	background: ${token.magicColorScales.violet[0]};
		// 	border-color: ${token.magicColorScales.violet[1]};

		// 	svg {
		// 		stroke: ${token.magicColorScales.violet[4]};
		// 	}
		// }
	`,
}))

interface ModeTagProps {
	mode?: string
}

function ModeTag({ mode = TopicMode.General }: ModeTagProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	const config = useMemo(() => {
		return computed(() => {
			return superMagicModeService.getModeConfigWithLegacy(mode, t)
		}).get()
	}, [mode, t])

	if (!config) {
		return (
			<div className={cx(styles.modeTag, "invalid")}>
				<MagicIcon component={IconMessageCircleQuestion} size={16} />
			</div>
		)
	}

	return (
		<div className={`${styles.modeTag} ${mode}`}>
			<IconComponent
				iconType={config.mode.icon_type}
				iconUrl={config.mode.icon_url}
				selectedIcon={config.mode.icon}
				size={16}
				iconColor={config.mode.color}
				showBorder={true}
			/>
		</div>
	)
}

export default memo(ModeTag)
