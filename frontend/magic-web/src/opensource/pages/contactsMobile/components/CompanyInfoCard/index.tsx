import { memo } from "react"

// Icons
import { CheckIcon, ChevronRightIcon, ConnectionIcon } from "./icons"

// Styles
import { useStyles } from "./styles"

// Types
import type { CompanyInfoProps } from "../../types"

/**
 * CompanyInfoCard - 企业信息卡片组件
 *
 * @param props - 组件属性
 * @returns JSX.Element
 */
const CompanyInfoCard = memo((props: CompanyInfoProps) => {
	const { name, badge, departments, className, style } = props
	const { styles } = useStyles()

	return (
		<div className={`${styles.container} ${className || ""}`} style={style}>
			{/* Company Info */}
			<div className={styles.companyInfo}>
				<div className={styles.companyAvatar}>
					{/* Company logo placeholder */}
					<svg width="32" height="27" viewBox="0 0 32 27" fill="none">
						<rect width="32" height="27" fill="#EEE" rx="4" />
						<path d="M8 8h16v2H8V8zm0 4h16v2H8v-2zm0 4h12v2H8v-2z" fill="#999" />
					</svg>
				</div>
				<div className={styles.textContent}>
					<div className={styles.companyName}>{name}</div>
					{badge && (
						<div className={styles.badgeContainer}>
							<div className={styles.badge}>
								<CheckIcon />
								<span>{badge}</span>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Departments */}
			{departments.map((department) => (
				<div
					key={department.id}
					className={styles.departmentItem}
					onClick={department.onClick}
				>
					<ConnectionIcon />
					<span className={styles.departmentText}>{department.name}</span>
					<ChevronRightIcon />
				</div>
			))}
		</div>
	)
})

CompanyInfoCard.displayName = "CompanyInfoCard"

export default CompanyInfoCard
