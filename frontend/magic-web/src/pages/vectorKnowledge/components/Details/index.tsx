import { useEffect, useMemo, useState } from "react"
import { Flex } from "antd"
import { IconChevronLeft } from "@tabler/icons-react"
import { useDebounceFn, useMemoizedFn } from "ahooks"
import { FlowRouteType } from "@/types/flow"
import MagicIcon from "@/components/base/MagicIcon"
import { useSearchParams } from "react-router-dom"
import useNavigate from "@/routes/hooks/useNavigate"
import { useTranslation } from "react-i18next"
import SubSider from "./components/SubSider"
import { useVectorKnowledgeDetailStyles } from "./styles"
import Setting from "./components/Setting"
import RecallTest from "./components/RecallTest"
import type { Knowledge } from "@/types/knowledge"
import { KnowledgeApi } from "@/apis"
import Document from "./components/Document"
import { RouteName } from "@/routes/constants"

export default function VectorKnowledgeDetail() {
	const { styles } = useVectorKnowledgeDetailStyles()

	const [searchParams] = useSearchParams()
	const knowledgeBaseCode = searchParams.get("code") || ""

	const navigate = useNavigate()

	const { t } = useTranslation("flow")

	const [knowledgeDetail, setKnowledgeDetail] = useState<Knowledge.Detail>()

	const [currentDetailPage, setCurrentDetailPage] = useState<
		"document" | "setting" | "recallTest"
	>("document")

	/**
	 * 更新知识库详情 - 使用防抖处理
	 */
	const { run: updateKnowledgeDetail } = useDebounceFn<(code: string) => Promise<void>>(
		async (code: string) => {
			const res = await KnowledgeApi.getKnowledgeDetail(code)
			if (res) {
				setKnowledgeDetail(res)
			}
		},
		{ wait: 300, leading: true, trailing: false },
	)

	/**
	 * 上一步 - 返回上一页
	 */
	const handleBack = useMemoizedFn(() => {
		navigate({
			name: RouteName.Flows,
			params: {
				type: FlowRouteType.VectorKnowledge,
			},
		})
	})

	// 获取知识库详情
	useEffect(() => {
		if (knowledgeBaseCode) {
			updateKnowledgeDetail(knowledgeBaseCode)
		}
	}, [knowledgeBaseCode])

	// 根据当前页面显示不同的内容
	const PageContent = useMemo(() => {
		if (knowledgeDetail && currentDetailPage === "document") {
			return (
				<Document
					className={styles.rightContainer}
					knowledgeBaseCode={knowledgeBaseCode}
					sourceType={knowledgeDetail.source_type}
					userOperation={knowledgeDetail.user_operation}
				/>
			)
		}

		if (knowledgeDetail && currentDetailPage === "setting") {
			return (
				<div className={styles.rightContainer}>
					<Setting
						knowledgeBase={knowledgeDetail}
						updateKnowledgeDetail={updateKnowledgeDetail}
					/>
				</div>
			)
		}

		if (currentDetailPage === "recallTest") {
			return (
				<div className={styles.rightContainer}>
					<RecallTest knowledgeBaseCode={knowledgeBaseCode} />
				</div>
			)
		}

		return null
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [knowledgeBaseCode, currentDetailPage, knowledgeDetail])

	return (
		<Flex className={styles.wrapper}>
			<Flex vertical className={styles.leftContainer}>
				<Flex className={styles.header} align="center" gap={14}>
					<MagicIcon
						component={IconChevronLeft}
						size={24}
						className={styles.arrow}
						onClick={handleBack}
					/>
					<div>{t("common.knowledgeDatabase")}</div>
				</Flex>
				{knowledgeDetail && (
					<SubSider
						knowledgeDetail={knowledgeDetail}
						setCurrentDetailPage={setCurrentDetailPage}
					/>
				)}
			</Flex>
			{PageContent}
		</Flex>
	)
}
