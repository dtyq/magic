import { useStyles } from "./styles"
import MagicScrollBar from "@/opensource/components/base/MagicScrollBar"
import { IconLight } from "@/opensource/enhance/tabler/icons-react"
import { IconCheck, IconChevronLeft, IconChevronRight, IconEdit, IconX } from "@tabler/icons-react"
import { colorUsages } from "@/opensource/providers/ThemeProvider/colors"
import { useTranslation } from "react-i18next"
import { useEffect, useState } from "react"
import { LongMemory } from "@/opensource/types/longMemory"
import { useMemoizedFn } from "ahooks"
import { LongMemoryApi, SuperMagicApi } from "@/opensource/apis"
import { Flex } from "antd"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { LongTremMemoryPage, PageProps } from "../../types"
import MagicEmpty from "@/opensource/components/base/MagicEmpty"
import { userStore } from "@/opensource/models/user"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

export default function MemorySuggestion({
	setPage,
	setEditMemory,
	setBreadcrumbList,
	onClose,
	onWorkspaceStateChange,
}: PageProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super/longMemory")

	const isMobile = useIsMobile()

	/** 待处理的记忆列表 */
	const [pendingMemoryList, setPendingMemoryList] = useState<LongMemory.Memory[]>([])

	/** 获取待处理的记忆列表 */
	const getPendingMemoryList = useMemoizedFn(async () => {
		try {
			const res = await LongMemoryApi.getMemories({
				status: [LongMemory.MemoryStatus.Pending, LongMemory.MemoryStatus.PENDING_REVISION],
				page_size: 99,
			})
			setPendingMemoryList(res.data)
			userStore.user.setPendingMemoryList(res.data || [])
		} catch (error) {
			console.log("🚀 ~ MemoryList ~ error:", error)
		}
	})

	/** 编辑记忆 */
	const handleEditMemory = useMemoizedFn((memory: LongMemory.Memory) => {
		setPage(LongTremMemoryPage.CreateOrEdit)
		setEditMemory(memory)
	})

	/** 拒绝记忆 */
	const handleMemoryReject = useMemoizedFn(async (memoryId: string) => {
		try {
			const res = await LongMemoryApi.batchAcceptMemories([memoryId], "reject")
			if (res.success) {
				getPendingMemoryList()
				magicToast.success(res.message)
			}
		} catch (error) {
			console.log("🚀 ~ handleMemoryReject ~ error:", error)
		}
	})

	/** 采纳记忆 */
	const handleMemoryAccept = useMemoizedFn(async (memoryId: string) => {
		try {
			const res = await LongMemoryApi.batchAcceptMemories([memoryId], "accept")
			if (res.success) {
				getPendingMemoryList()
				magicToast.success(res.message)
			}
		} catch (error) {
			console.log("🚀 ~ handleMemoryAccept ~ error:", error)
		}
	})

	/** 点击项目 */
	const handleProjectClick = useMemoizedFn(async (projectId: string | null) => {
		if (!projectId) return
		try {
			const res = await SuperMagicApi.getProjectDetail({ id: projectId })
			if (res) {
				onClose()
				onWorkspaceStateChange({
					workspaceId: res.workspace_id,
					projectId,
					topicId: null,
				})
			}
		} catch (error) {
			console.log("🚀 ~ handleProjectClick ~ error:", error)
		}
	})

	useEffect(() => {
		setBreadcrumbList([t("memorySuggestion")])
		getPendingMemoryList()
	}, [])

	return (
		<>
			{isMobile && (
				<div className={styles.header}>
					<div className={styles.back} onClick={() => setPage(LongTremMemoryPage.List)}>
						<IconChevronLeft size={24} stroke={1.5} />
					</div>
					<Flex flex={1} justify="space-between" align="center">
						<div className={styles.title}>{t("pendingMemory")}</div>
						<div className={styles.headerCount}>
							{t("memorySuggestionCount", { count: pendingMemoryList.length })}
						</div>
					</Flex>
					<div className={styles.close} onClick={onClose}>
						<IconX size={24} />
					</div>
				</div>
			)}
			<div className={styles.wrapper} data-attr="test">
				{!isMobile && (
					<div className={styles.menu}>
						{t("pendingMemory")}
						<div className={styles.tip}>
							{t("memorySuggestionCount", { count: pendingMemoryList.length })}
						</div>
					</div>
				)}
				<div className={styles.body}>
					{pendingMemoryList.length > 0 ? (
						<MagicScrollBar className={styles.scroll} autoHide={false}>
							{pendingMemoryList.map((memory) => (
								<div key={memory.id} className={styles.item}>
									<div className={styles.itemHeader}>
										<span className={styles.itemLabel}>
											<IconLight size={20} />
											{memory.status ===
											LongMemory.MemoryStatus.PENDING_REVISION
												? t("memoryRevisionSuggestion")
												: t("memorySuggestion")}
										</span>
										{!isMobile && (
											<div className={styles.itemMenu}>
												<div
													className={styles.button}
													onClick={() => handleEditMemory(memory)}
												>
													<IconEdit
														color={colorUsages.text[1]}
														size={18}
													/>
													{t("edit")}
												</div>
												<div
													className={cx(styles.button, styles.buttonFail)}
													onClick={() => handleMemoryReject(memory.id)}
												>
													<IconX
														color={colorUsages.danger.default}
														size={18}
													/>
													{t("rejectMemory")}
												</div>
												<div
													className={cx(
														styles.button,
														styles.buttonSuccess,
													)}
													onClick={() => handleMemoryAccept(memory.id)}
												>
													<IconCheck
														color={colorUsages.success.default}
														size={18}
													/>
													{t("acceptMemory")}
												</div>
											</div>
										)}
									</div>
									{memory.status === LongMemory.MemoryStatus.PENDING_REVISION && (
										<div className={styles.tag}>{memory.content}</div>
									)}
									<div className={styles.itemFooter}>
										{memory.pending_content}
									</div>
									<div>
										{memory.project_id ? (
											<div className={styles.memoryType}>
												<div>{t("associatedProject")}</div>
												<div
													className={styles.memoryProjectName}
													onClick={() =>
														handleProjectClick(memory.project_id)
													}
												>
													<div>{memory.project_name}</div>
													<IconChevronRight size={16} />
												</div>
											</div>
										) : (
											<div
												className={cx(
													styles.memoryType,
													styles.globalMemoryType,
												)}
											>
												{t("globalMemory")}
											</div>
										)}
									</div>

									{isMobile && (
										<div className={styles.itemMenu}>
											<div
												className={styles.button}
												onClick={() => handleEditMemory(memory)}
											>
												<IconEdit color={colorUsages.text[1]} size={18} />
												{t("edit")}
											</div>
											<div
												className={cx(styles.button, styles.buttonFail)}
												onClick={() => handleMemoryReject(memory.id)}
											>
												<IconX
													color={colorUsages.danger.default}
													size={18}
												/>
												{t("rejectMemory")}
											</div>
											<div
												className={cx(styles.button, styles.buttonSuccess)}
												onClick={() => handleMemoryAccept(memory.id)}
											>
												<IconCheck
													color={colorUsages.success.default}
													size={18}
												/>
												{t("acceptMemory")}
											</div>
										</div>
									)}
								</div>
							))}
						</MagicScrollBar>
					) : (
						<div className={styles.empty}>
							<MagicEmpty />
						</div>
					)}
				</div>
			</div>
		</>
	)
}
