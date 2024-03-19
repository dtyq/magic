import { observer } from "mobx-react-lite"

// Styles
import { useStyles } from "./styles"

// Types
import type { PartnerProps } from "../../types"
import { IconChevronRight, IconHeartHandshake } from "@tabler/icons-react"
import MagicIcon from "@/opensource/components/base/MagicIcon"

/**
 * PartnerCard - 合作伙伴卡片组件
 *
 * @param props - 组件属性
 * @returns JSX.Element
 */
const PartnerCard = observer((props: PartnerProps) => {
	const { partners, className, style } = props
	const { styles } = useStyles()

	const renderPartnerIcon = (partner: any) => {
		if (partner.type === "customer" || partner.type === "agent") {
			return <MagicIcon component={IconHeartHandshake} />
		}

		// For company partners, show logo placeholder
		return <div className={styles.logoPlaceholder}>{partner.name.charAt(0)}</div>
	}

	return (
		<div className={`${styles.container} ${className || ""}`} style={style}>
			{partners.map((partner) => (
				<div key={partner.id} className={styles.partnerItem} onClick={partner.onClick}>
					<div className={styles.iconContainer}>{renderPartnerIcon(partner)}</div>
					<span className={styles.partnerText}>{partner.name}</span>
					<MagicIcon component={IconChevronRight} />
				</div>
			))}
		</div>
	)
})

PartnerCard.displayName = "PartnerCard"

export default PartnerCard
