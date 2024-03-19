import { Flex, Menu } from "antd"
import { useLocation } from "react-router-dom"
import { useMemoizedFn } from "ahooks"
import { IconChevronRight } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import type { Knowledge } from "@/opensource/types/knowledge"
import DEFAULT_KNOWLEDGE_ICON from "@/opensource/assets/logos/knowledge-avatar.png"
import { useVectorKnowledgeSubSiderStyles } from "./styles"
import {
	hasAdminRight,
	ResourceTypes,
} from "@/opensource/pages/flow/components/AuthControlButton/types"
import AuthControlButton from "@/opensource/pages/flow/components/AuthControlButton/AuthControlButton"
import { DataSourceType } from "@/opensource/pages/vectorKnowledge/constant"

interface SubSiderProps {
	setCurrentDetailPage: (page: "document" | "setting" | "recallTest") => void
	knowledgeDetail: Knowledge.Detail
}

export default function SubSider({ setCurrentDetailPage, knowledgeDetail }: SubSiderProps) {
	const { styles } = useVectorKnowledgeSubSiderStyles()
	const location = useLocation()
	const { t } = useTranslation("flow")

	// 获取当前页面路径
	const isDocument = location.pathname.includes("/document")
	const isSetting = location.pathname.includes("/setting")
	const isRecallTest = location.pathname.includes("/recall-test")

	// 默认选中的菜单项
	let defaultSelectedKey = "document"
	if (isDocument) {
		defaultSelectedKey = "document"
	} else if (isSetting) {
		defaultSelectedKey = "setting"
	} else if (isRecallTest) {
		defaultSelectedKey = "recallTest"
	}

	// 菜单点击处理
	const handleMenuClick = useMemoizedFn(({ key }: { key: string }) => {
		setCurrentDetailPage(key as "document" | "setting" | "recallTest")
	})

	return (
		<Flex vertical className={styles.container}>
			<div className={styles.info}>
				{knowledgeDetail.source_type === DataSourceType.Local && (
					<div className={styles.sourceType}>{t("knowledgeDatabase.localKnowledge")}</div>
				)}
				{knowledgeDetail.source_type === DataSourceType.Enterprise && (
					<div className={styles.sourceType}>
						{t("knowledgeDatabase.bindEnterpriseKnowledge")}
					</div>
				)}
				<Flex align="center" gap={8}>
					<img
						className={styles.logoImg}
						src={knowledgeDetail.icon || DEFAULT_KNOWLEDGE_ICON}
						alt=""
					/>
					<div className={styles.name}>{knowledgeDetail.name}</div>
				</Flex>
				<div>
					<div className={styles.descLabel}>{t("knowledgeDatabase.descLabel")}</div>
					<div className={styles.descContent}>
						{knowledgeDetail.description || t("knowledgeDatabase.noDescription")}
					</div>
				</div>
				<Flex align="center" gap={4} style={{ marginTop: 10 }}>
					<AuthControlButton
						className={styles.operationBtn}
						resourceType={ResourceTypes.Knowledge}
						resourceId={knowledgeDetail.id}
						disabled={!hasAdminRight(knowledgeDetail.user_operation)}
					/>
				</Flex>
			</div>
			<Menu
				className={styles.menu}
				mode="inline"
				defaultSelectedKeys={[defaultSelectedKey]}
				onClick={handleMenuClick}
				items={[
					{
						key: "document",
						label: (
							<Flex
								justify="space-between"
								align="center"
								className={styles.menuItem}
							>
								<div>{t("knowledgeDatabase.documentTitle")}</div>
								<IconChevronRight size={16} />
							</Flex>
						),
					},
					{
						key: "recallTest",
						label: (
							<Flex
								justify="space-between"
								align="center"
								className={styles.menuItem}
							>
								<div>{t("knowledgeDatabase.recallTest")}</div>
								<IconChevronRight size={16} />
							</Flex>
						),
					},
					{
						key: "setting",
						label: (
							<Flex
								justify="space-between"
								align="center"
								className={styles.menuItem}
							>
								<div>{t("knowledgeDatabase.setting")}</div>
								<IconChevronRight size={16} />
							</Flex>
						),
					},
				]}
			/>
		</Flex>
	)
}
