import { IconChevronRight } from "@tabler/icons-react"
import { cx } from "antd-style"
import { Flex } from "antd"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { IconLight } from "@/enhance/tabler/icons-react"
import { userStore } from "@/models/user"
import { openLongTremMemoryModal, preloadLongTremMemoryModal } from "../LongTremMemory"
import type { NavigateToStateParams } from "../../services/routeManageService"
import { useStyles } from "./styles"

interface LongMemoryButtonProps {
	onWorkspaceStateChange: (params: NavigateToStateParams) => void
}

function LongMemoryButton({ onWorkspaceStateChange }: LongMemoryButtonProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("super")
	const { pendingMemoryList } = userStore.user

	const handleClick = () => {
		openLongTremMemoryModal({ onWorkspaceStateChange })
	}

	return (
		<div
			className={cx(
				styles.longMemoryContainer,
				pendingMemoryList.length > 0 && styles.longMemoryContainerActive,
			)}
			onClick={handleClick}
			onMouseEnter={preloadLongTremMemoryModal}
		>
			<IconLight size={16} />
			<Flex align="center" gap={4}>
				{t("longMemory", { ns: "super/longMemory" })}
				{pendingMemoryList.length > 0 && (
					<>
						<div>·</div>
						<div>
							{t("memorySuggestionCount", {
								count: pendingMemoryList.length,
								ns: "super/longMemory",
							})}
						</div>
					</>
				)}
			</Flex>
			<IconChevronRight size={16} color="currentColor" />
		</div>
	)
}

export default observer(LongMemoryButton)
