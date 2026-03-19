import { useUserDetailStyles } from "./styles"

/**
 * Mobile user detail page MemberCard configuration
 * 移动端用户详情页面的 MemberCard 配置
 */
export function useMemberCardConfig() {
	const { styles } = useUserDetailStyles()

	return {
		classNames: {
			container: styles.memberCard,
			header: styles.header,
			headerTop: styles.headerTop,
			avatar: styles.avatar,
			username: styles.username,
			organization: styles.organization,
			descriptions: styles.descriptions,
			segmented: styles.segmented,
		},
		style: {
			position: "fixed" as const,
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
		},
		showButtons: false,
	}
}
