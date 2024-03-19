import { cx } from "antd-style"
import { memo, useEffect, useMemo, useState } from "react"
import { useStyles } from "./styles"
import { useTranslation } from "react-i18next"
import { getSuperMagicCasesUrl } from "@/opensource/pages/superMagic/constants"
import { SupportLocales } from "@/opensource/constants/locale"

interface WorkspaceCaseProps {
	className?: string
	style?: React.CSSProperties
}

export default memo(function WorkspaceCase({ className, style }: WorkspaceCaseProps) {
	const { i18n } = useTranslation()
	const { styles } = useStyles()
	const [list, setList] = useState<any[]>([])
	const [activeGroupKey, setActiveGroupKey] = useState<string>("0")

	const currentGroup = useMemo(() => {
		return list.find((item) => item.key === activeGroupKey)
	}, [activeGroupKey, list])

	const openInNewTab = (url: string) => {
		const a = document.createElement("a")
		a.href = url
		a.target = "_blank"
		a.rel = "noopener noreferrer"
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
	}

	useEffect(() => {
		fetch(`${getSuperMagicCasesUrl(i18n.language as SupportLocales)}?t=${Date.now()}`, {
			mode: "cors",
		})
			.then((res) => res.json())
			.then((res) => {
				setList(res)
			})
	}, [i18n.language])

	return (
		<div className={cx(styles.container, className)} style={style}>
			<div className={styles.list}>
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
							{item.name}
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
							<div className={styles.caseItemTitle}>{item.title}</div>
							<div className={styles.caseItemSubTitle}>{item.subTitle}</div>
							{item.image ? (
								<img src={item.image} className={styles.caseItemImage} />
							) : (
								<div className={styles.caseItemImage} />
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
})
