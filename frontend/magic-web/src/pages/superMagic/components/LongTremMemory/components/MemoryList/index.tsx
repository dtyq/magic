import { Button, Divider, Flex, Switch, Tabs } from "antd"
import { IconLight } from "@/enhance/tabler/icons-react"
import { IconChevronRight, IconPlus, IconX } from "@tabler/icons-react"
import ActiveMemoriesTable from "../Table"
import { useStyles } from "./styles"
import { useTranslation } from "react-i18next"
import { useMemo, useState } from "react"
import { LongMemoryApi } from "@/apis"
import { LongMemory } from "@/types/longMemory"
import { useIsMobile } from "@/hooks/useIsMobile"
import { LongTremMemoryPage, MemoryTypeTab, PageProps } from "../../types"
import { useAsyncEffect } from "ahooks"

export default function MemoryList({
	setPage,
	editMemory,
	setEditMemory,
	setBreadcrumbList,
	onClose,
	onWorkspaceStateChange,
}: PageProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("super/longMemory")

	const isMobile = useIsMobile()

	const [pendingMemoryLength, setPendingMemoryLength] = useState(0)

	const [activeTab, setActiveTab] = useState(MemoryTypeTab.GlobalMemory)

	const items = useMemo(
		() => [
			{
				label: t("globalMemory"),
				key: MemoryTypeTab.GlobalMemory,
			},
			{
				label: t("projectMemory"),
				key: MemoryTypeTab.ProjectMemory,
			},
		],
		[t],
	)

	const onChange = (key: string) => {
		setActiveTab(key as MemoryTypeTab)
	}

	useAsyncEffect(async () => {
		try {
			setBreadcrumbList([])
			const res = await LongMemoryApi.getMemories({
				status: [LongMemory.MemoryStatus.Pending, LongMemory.MemoryStatus.PENDING_REVISION],
				page_size: 99,
			})
			setPendingMemoryLength(res.total)
		} catch (error) {
			console.log("🚀 ~ MemoryList ~ error:", error)
		}
	}, [])

	return (
		<>
			{isMobile && (
				<div className={styles.header}>
					<div className={styles.title}>{t("longMemory")}</div>
					<div className={styles.close} onClick={onClose}>
						<IconX size={24} />
					</div>
				</div>
			)}
			<div className={styles.section}>
				<div className={styles.tip}>
					<Flex vertical gap={4}>
						<Flex gap={4} align="center">
							<div className={styles.tipTitle}>{t("autoLearn")}</div>
							{/* <Switch size="small" /> */}
						</Flex>
						<div className={styles.titleDesc}>{t("autoLearnDesc")}</div>
					</Flex>

					{pendingMemoryLength > 0 && (
						<>
							<Divider className={styles.divider} />
							<Flex align="center" gap={10}>
								<div className={styles.tag}>
									<IconLight size={20} />
									{t("memorySuggestion")}
								</div>
								<div
									className={styles.handlerButton}
									onClick={() => setPage(LongTremMemoryPage.Suggestion)}
								>
									{t("memorySuggestionCount", { count: pendingMemoryLength })}
									<IconChevronRight size={16} />
								</div>
							</Flex>
						</>
					)}
				</div>
				<Tabs
					className={styles.tabs}
					activeKey={activeTab}
					items={items}
					onChange={onChange}
				/>
				<div className={styles.wrapper}>
					<div className={styles.wrapperDesc}>{t("globalMemoryDesc")}</div>
					{!isMobile && (
						<div
							className={styles.addMemory}
							onClick={() => setPage(LongTremMemoryPage.CreateOrEdit)}
						>
							<IconPlus size={20} />
							<div>{t("addMemory")}</div>
						</div>
					)}
				</div>
			</div>
			<div className={styles.body}>
				<ActiveMemoriesTable
					activeTab={activeTab}
					setPage={setPage}
					setEditMemory={setEditMemory}
					onWorkspaceStateChange={onWorkspaceStateChange}
					onClose={onClose}
				/>
			</div>

			{isMobile && (
				<div className={styles.mobileFooter}>
					<Button
						type="primary"
						className={styles.mobileFooterBtn}
						onClick={() => setPage(LongTremMemoryPage.CreateOrEdit)}
					>
						<IconPlus size={20} stroke={2} />
						<div>{t("addMemory")}</div>
					</Button>
				</div>
			)}
		</>
	)
}
