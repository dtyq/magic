import {
	IconChevronRight,
	IconOctahedron,
	IconBrain,
	IconClockPlay,
	IconHeart,
	IconShare3,
} from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import FlexBox from "@/components/base/FlexBox"
import { useStyles } from "./styles"
import { openLongTremMemoryModal } from "@/pages/superMagic/components/LongTremMemory"
import { openShareManagementModal } from "@/pages/superMagic/components/ShareManagement/openShareManagementModal"
import { userStore } from "@/models/user"
import { observer } from "mobx-react-lite"
import { useEffect } from "react"
import { LongMemoryApi } from "@/apis"
import { LongMemory } from "@/types/longMemory"
import { projectStore } from "@/pages/superMagic/stores/core"

interface MenuItemProps {
	icon: React.ReactNode
	title: string
	badge?: React.ReactNode
	onClick?: () => void
}

function MenuItem({ icon, title, badge, onClick }: MenuItemProps) {
	const { styles } = useStyles()

	return (
		<div className={styles.menuItem} onClick={onClick}>
			<FlexBox gap={8} align="center">
				<div className={styles.iconWrapper}>{icon}</div>
				<div className={styles.menuTitle}>{title}</div>
				{badge}
			</FlexBox>
			<IconChevronRight className={styles.arrow} />
		</div>
	)
}

export default observer(function WorkspaceSection({ toWorkspace }: { toWorkspace: () => void }) {
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	const { pendingMemoryList, setPendingMemoryList } = userStore.user
	const selectedProject = projectStore.selectedProject

	const workspaceIcon = (
		<div className={styles.workspaceIcon}>
			<IconOctahedron size={20} color="white" />
		</div>
	)

	const memoryIcon = (
		<div className={styles.memoryIcon}>
			<IconBrain size={20} color="white" />
		</div>
	)

	const shareIcon = (
		<div className={styles.shareIcon}>
			<IconShare3 size={20} color="white" />
		</div>
	)

	// const scheduleIcon = (
	// 	<div className={styles.scheduleIcon}>
	// 		<IconClockPlay size={20} />
	// 	</div>
	// )

	// const preferenceIcon = (
	// 	<div className={styles.preferenceIcon}>
	// 		<IconHeart size={20} />
	// 	</div>
	// )

	const notificationBadge =
		pendingMemoryList.length > 0 ? (
			<div className={styles.badge}>
				<span className={styles.badgeText}>{pendingMemoryList.length}</span>
			</div>
		) : null

	useEffect(() => {
		try {
			LongMemoryApi.getMemories({
				status: [LongMemory.MemoryStatus.Pending, LongMemory.MemoryStatus.PENDING_REVISION],
				page_size: 99,
			}).then((res) => {
				if (res?.success) {
					setPendingMemoryList(res.data || [])
				}
			})
		} catch (error) {
			console.error(error)
		}
	}, [])

	return (
		<div className={styles.container}>
			<MenuItem
				icon={workspaceIcon}
				title={t("mobile.navigate.workspace")}
				onClick={toWorkspace}
			/>
			<div className={styles.divider} />
			<MenuItem
				icon={memoryIcon}
				title={t("mobile.navigate.longTermMemory")}
				badge={notificationBadge}
				onClick={() => openLongTremMemoryModal({ onWorkspaceStateChange: () => { } })}
			/>
			{selectedProject && (
				<>
					<div className={styles.divider} />
					<MenuItem
						icon={shareIcon}
						title={t("mobile.navigate.shareManagement")}
						onClick={() => openShareManagementModal(selectedProject.id, true)}
					/>
				</>
			)}
			{/* <div className={styles.divider} />
			<MenuItem icon={scheduleIcon} title={t("mobile.navigate.scheduledTasks")} />
			<div className={styles.divider} />
			<MenuItem icon={preferenceIcon} title={t("mobile.navigate.preferences")} /> */}
		</div>
	)
})
