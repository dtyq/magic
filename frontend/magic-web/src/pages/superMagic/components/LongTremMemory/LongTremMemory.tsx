import { useStyles } from "./styles"
import { Flex } from "antd"
import { IconX, IconBrain, IconChevronLeft } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { LongTremMemoryPage } from "./types"
import { createElement, lazy, Suspense, useEffect, useMemo, useState } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { userStore } from "@/models/user"
import type { NavigateToStateParams } from "@/pages/superMagic/services/routeManageService"
import { LongMemory } from "@/types/longMemory"
import type { AgentCommonModalChildrenProps } from "@/components/Agent/AgentCommonModal/types"

const MemoryList = lazy(() => import("./components/MemoryList"))
const MemorySuggestion = lazy(() => import("./components/MemorySuggestion"))
const MemoryCreate = lazy(() => import("./components/MemoryCreate"))

const MemoryPage = {
	[LongTremMemoryPage.List]: MemoryList,
	[LongTremMemoryPage.Suggestion]: MemorySuggestion,
	[LongTremMemoryPage.CreateOrEdit]: MemoryCreate,
}

export interface LongTremMemoryProps extends AgentCommonModalChildrenProps {
	onWorkspaceStateChange: (params: NavigateToStateParams) => void
}

export default observer(function LongTremMemory(props: LongTremMemoryProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("super/longMemory")

	const { pendingMemoryList } = userStore.user

	const isMobile = useIsMobile()

	/** 当前所处的页面 */
	const [page, setPage] = useState<LongTremMemoryPage>(LongTremMemoryPage.List)
	/** 处于编辑状态的记忆id */
	const [editMemory, setEditMemory] = useState<LongMemory.Memory | undefined>()
	/** 顶部展示的面包屑列表 */
	const [breadcrumbList, setBreadcrumbList] = useState<string[]>([])

	const showBack = useMemo(() => {
		return page !== LongTremMemoryPage.List
	}, [page])

	const handleClose = useMemoizedFn(() => {
		setPage(LongTremMemoryPage.List)
		setEditMemory(undefined)
		props?.onClose?.()
	})

	const handleBack = useMemoizedFn(() => {
		if (
			editMemory &&
			[LongMemory.MemoryStatus.Pending, LongMemory.MemoryStatus.PENDING_REVISION].includes(
				editMemory.status,
			)
		) {
			setPage(LongTremMemoryPage.Suggestion)
		} else {
			setPage(LongTremMemoryPage.List)
		}
	})

	useEffect(() => {
		if (page !== LongTremMemoryPage.CreateOrEdit) {
			setEditMemory(undefined)
		}
	}, [page])

	useEffect(() => {
		if (pendingMemoryList.length > 0) {
			setPage(LongTremMemoryPage.Suggestion)
		}
	}, [pendingMemoryList.length])

	return (
		<div className={styles.layout}>
			<div className={styles.main}>
				{!isMobile && (
					<div className={styles.header}>
						<Flex gap={8} align="center">
							{showBack && (
								<div className={styles.back} onClick={handleBack}>
									<IconChevronLeft size={24} stroke={1.5} />
								</div>
							)}

							<div className={styles.icon}>
								<IconBrain size={24} />
							</div>

							<Flex gap={8} align="center">
								<div>{t("longMemory")}</div>
								{breadcrumbList.map((item) => (
									<Flex gap={8} align="center" key={item}>
										<div className={styles.breadcrumbDivider}>/</div>
										<div>{item}</div>
									</Flex>
								))}
							</Flex>
						</Flex>
						<div className={styles.close} onClick={handleClose}>
							<IconX size={24} />
						</div>
					</div>
				)}
			</div>
			<Suspense fallback={null}>
				{createElement(MemoryPage[page], {
					setPage,
					editMemory,
					setEditMemory,
					setBreadcrumbList,
					onClose: handleClose,
					onWorkspaceStateChange: props.onWorkspaceStateChange,
				})}
			</Suspense>
		</div>
	)
})
