import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import IconWorkspaceCase from "@/opensource/components/icons/IconWorkspaceCase"
import { getSuperMagicCasesUrl } from "@/opensource/pages/superMagic/constants"
import { SupportLocales } from "@/opensource/constants/locale"
import { openInNewTab } from "@/opensource/pages/superMagic/utils/project"
import IconPlay from "@/opensource/pages/superMagic/assets/svg/view_playback.svg"
import LazyImage from "../LazyImage"
import useStyles from "../../style"
import { useMemoizedFn, useUpdateEffect } from "ahooks"

interface LazyCasesWrapperProps {
	className?: string
}

export default function LazyCasesWrapper({ className }: LazyCasesWrapperProps) {
	const { t, i18n } = useTranslation("super")
	const { styles, cx } = useStyles()
	const containerRef = useRef<HTMLDivElement>(null)
	const [list, setList] = useState<any[]>([])
	const [activeGroupKey, setActiveGroupKey] = useState<string>("0")
	const [isLoading, setIsLoading] = useState(false)

	/** 获取案例数据 */
	const fetchCases = useMemoizedFn(() => {
		if (isLoading) return
		setIsLoading(true)
		const url = `${getSuperMagicCasesUrl(i18n.language as SupportLocales)}?t=${Date.now()}`
		fetch(url, {
			mode: "cors",
		})
			.then((res) => res.json())
			.then((res) => {
				setList(res)
			})
			.catch((error) => {
				console.error("Failed to fetch cases data:", error)
			})
			.finally(() => {
				setIsLoading(false)
			})
	})

	// 监听容器是否进入视口
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries
				if (entry.isIntersecting) {
					fetchCases()
					observer.disconnect()
				}
			},
			{
				// 提前 200px 开始加载
				rootMargin: "200px",
				threshold: 0.1,
			},
		)

		if (containerRef.current) {
			observer.observe(containerRef.current)
		}

		return () => {
			observer.disconnect()
		}
	}, [])

	// 当进入视口时获取数据
	useUpdateEffect(() => {
		fetchCases()
	}, [i18n.language])

	const currentGroup = list.find((item) => item.key === activeGroupKey)

	// 加载中状态
	if (isLoading) {
		return (
			<div ref={containerRef} className={cx(styles.casesWrapper, className)}>
				<div className={styles.caseTitle}>
					<IconWorkspaceCase size={32} />
					<div>{t("common.hundredTimesProductivity")}</div>
				</div>
				<div
					style={{
						height: "200px",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<div style={{ color: "#999", fontSize: "14px" }}>{t("common.loading")}</div>
				</div>
			</div>
		)
	}

	// 渲染完整内容
	return (
		<div ref={containerRef} className={cx(styles.casesWrapper, className)}>
			<div className={styles.caseTitle}>
				<IconWorkspaceCase size={32} />
				<div>{t("common.hundredTimesProductivity")}</div>
			</div>

			<div className={styles.caseTypeList}>
				{list.map((item) => {
					const isActive = activeGroupKey === item.key
					return (
						<div
							key={item.key}
							className={cx(
								styles.caseTypeItem,
								isActive && styles.caseTypeItemActive,
							)}
							onClick={() => {
								setActiveGroupKey(item.key)
							}}
						>
							<div>{item.name}</div>
							{isActive && <div className={styles.caseTypeItemActiveLine} />}
						</div>
					)
				})}
			</div>

			<div className={styles.case}>
				{currentGroup?.children.map((item: any, index: number) => {
					return (
						<div
							key={index}
							className={cx(styles.caseItem)}
							onClick={() => {
								openInNewTab(item.url)
							}}
						>
							<div className={styles.caseItemContent}>
								<div className={styles.caseItemTitle}>{item.title}</div>
								<div className={styles.caseItemSubTitle}>{item.subTitle}</div>
							</div>
							{item.image ? (
								<LazyImage
									src={item.image}
									className={styles.caseItemImage}
									placeholder={<div className={styles.caseItemImage} />}
								/>
							) : (
								<div className={styles.caseItemImage} />
							)}
							<div className={styles.caseItemPlay} data-play-button="true">
								<img src={IconPlay} alt="" draggable="false" />
								<div>{t("common.watchReplay")}</div>
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}
