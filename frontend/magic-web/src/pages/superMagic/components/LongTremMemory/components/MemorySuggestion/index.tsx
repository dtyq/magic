import { useStyles } from "./styles"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { IconLight } from "@/enhance/tabler/icons-react"
import { IconCheck, IconChevronLeft, IconChevronRight, IconEdit, IconX } from "@tabler/icons-react"
import { colorUsages } from "@/providers/ThemeProvider/colors"
import { useTranslation } from "react-i18next"
import { useEffect, useState } from "react"
import { LongMemory } from "@/types/longMemory"
import { useMemoizedFn } from "ahooks"
import { LongMemoryApi, SuperMagicApi } from "@/apis"
import { Flex } from "antd"
import { useIsMobile } from "@/hooks/useIsMobile"
import { LongTremMemoryPage, PageProps } from "../../types"
import MagicEmpty from "@/components/base/MagicEmpty"
import { userStore } from "@/models/user"
import magicToast from "@/components/base/MagicToaster/utils"

export default function MemorySuggestion({
	setPage,
	setEditMemory,
	setBreadcrumbList,
	onClose,
	onMemoryChanged,
	onWorkspaceStateChange,
}: PageProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super/longMemory")

	const isMobile = useIsMobile()

	/** Pending memory suggestions. */
	const [pendingMemoryList, setPendingMemoryList] = useState<LongMemory.Memory[]>([])

	/** Fetch pending memory suggestions. */
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

	/** Edit a memory. */
	const handleEditMemory = useMemoizedFn((memory: LongMemory.Memory) => {
		setPage(LongTremMemoryPage.CreateOrEdit)
		setEditMemory(memory)
	})

	/** Reject a memory suggestion. */
	const handleMemoryReject = useMemoizedFn(async (memoryId: string) => {
		try {
			const res = await LongMemoryApi.batchAcceptMemories([memoryId], "reject")
			if (res.success) {
				onMemoryChanged?.()
				getPendingMemoryList()
				magicToast.success(res.message)
			}
		} catch (error) {
			console.log("🚀 ~ handleMemoryReject ~ error:", error)
		}
	})

	/** Accept a memory suggestion. */
	const handleMemoryAccept = useMemoizedFn(async (memoryId: string) => {
		try {
			const res = await LongMemoryApi.batchAcceptMemories([memoryId], "accept")
			if (res.success) {
				onMemoryChanged?.()
				getPendingMemoryList()
				magicToast.success(res.message)
			}
		} catch (error) {
			console.log("🚀 ~ handleMemoryAccept ~ error:", error)
		}
	})

	/** Open the associated project. */
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
					<div
						className={styles.back}
						onClick={() => setPage(LongTremMemoryPage.List)}
						data-testid="set-page"
					>
						<IconChevronLeft size={24} stroke={1.5} />
					</div>
					<Flex flex={1} justify="space-between" align="center">
						<div className={styles.title}>{t("pendingMemory")}</div>
						<div className={styles.headerCount}>
							{t("memorySuggestionCount", { count: pendingMemoryList.length })}
						</div>
					</Flex>
					<div className={styles.close} onClick={onClose} data-testid="on-close">
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
						<ScrollArea
							className={styles.scroll}
							viewportClassName={styles.scrollViewport}
							type="always"
						>
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
													data-testid="handle-edit-memory"
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
													data-testid="handle-memory-reject"
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
													data-testid="handle-memory-accept"
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
													data-testid="handle-project-click"
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
												data-testid="handle-edit-memory-2"
											>
												<IconEdit color={colorUsages.text[1]} size={18} />
												{t("edit")}
											</div>
											<div
												className={cx(styles.button, styles.buttonFail)}
												onClick={() => handleMemoryReject(memory.id)}
												data-testid="handle-memory-reject-2"
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
												data-testid="handle-memory-accept-2"
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
						</ScrollArea>
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
