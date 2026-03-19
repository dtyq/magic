import type { FlowDraft } from "@/types/flow"
import { Flex, Tooltip } from "antd"
import EmptyIcon from "@/assets/logos/empty.svg"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { useMemo } from "react"
import { cx } from "antd-style"
import MagicAvatar from "@/components/base/MagicAvatar"
import { useTranslation } from "react-i18next"
import { useStyles } from "./style"

export type PublishCardItemProps = {
	version: FlowDraft.ListItem
	flow?: MagicFlow.Flow
	onSwitchDraft: (version: FlowDraft.ListItem) => void
}

export default function PublishCardItem({ version, flow, onSwitchDraft }: PublishCardItemProps) {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()
	const { t: globalT } = useTranslation()
	const isActiveVersion = useMemo(() => {
		// @ts-ignore
		return flow?.version_code === version.id
	}, [flow, version.id])

	return (
		<div
			className={cx(styles.draftCardItem, {
				[styles.active]: isActiveVersion,
			})}
			onClick={() => onSwitchDraft(version)}
		>
			<Flex className={styles.header} justify="space-between">
				<Flex>
					<Tooltip title={version.name}>
						<span className={styles.draftName}>
							{t("flow.version")} {version.name}
						</span>
					</Tooltip>
				</Flex>
				<Flex gap={8} onClick={(e) => e.stopPropagation()}>
					{/* @ts-ignore */}
					<span>{version.created_time}</span>
				</Flex>
			</Flex>
			<span className={styles.draftDesc}>{version.description}</span>
			<Flex justify="space-between">
				<Flex justify="space-between" gap={4} align="center">
					<MagicAvatar
						className={styles.avatarIcon}
						size={20}
						shape="circle"
						src={version?.modifier_info?.avatar || EmptyIcon}
					/>
					<span className={styles.name}>
						{version?.modifier_info?.name ||
							globalT("common.unknownUser", { ns: "flow" })}
					</span>
				</Flex>
			</Flex>
		</div>
	)
}
