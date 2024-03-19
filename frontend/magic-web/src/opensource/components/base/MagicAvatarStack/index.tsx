import { memo } from "react"
import { createStyles } from "antd-style"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"

interface CollaboratorLike {
	id: string | number
	name: string
	avatar_url?: string
}

interface MagicAvatarStackProps {
	members: CollaboratorLike[]
	max?: number
	size?: number
	overlap?: number
	className?: string
	totalCount?: number
	"data-testid"?: string
}

const useStyles = createStyles(({ token }) => ({
	avatarStack: {
		position: "relative",
		height: 20,
		display: "flex",
		alignItems: "center",
	},
	moreCircle: {
		width: 20,
		height: 20,
		borderRadius: 100,
		border: `1px solid ${token.magicColorUsages?.border ?? token.colorBorder}`,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		background: token.colorBgContainer,
		fontFamily:
			"Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
		fontSize: 10,
		lineHeight: "13px",
		color: token.magicColorUsages?.text?.[1] ?? token.colorText,
		fontWeight: 600,
	},
}))

function MagicAvatarStack({
	members,
	max = 4,
	size = 20,
	overlap = 6,
	className,
	totalCount,
	"data-testid": dataTestId,
}: MagicAvatarStackProps) {
	const { styles, cx } = useStyles()
	const visible = members.slice(0, max)
	const total = typeof totalCount === "number" ? totalCount : members?.length || 0
	const restCount = total - visible.length

	return (
		<div className={cx(styles.avatarStack, className)} data-testid={dataTestId}>
			{visible.map((m, idx) => (
				<MagicAvatar
					key={m.id}
					src={m.avatar_url}
					size={size}
					shape="circle"
					style={{ marginLeft: idx === 0 ? 0 : -overlap, zIndex: idx }}
					data-testid={dataTestId ? `${dataTestId}-avatar-${idx}` : undefined}
				>
					{m.name}
				</MagicAvatar>
			))}
			{restCount > 0 && (
				<div
					className={styles.moreCircle}
					style={{ marginLeft: -overlap, zIndex: visible.length }}
					data-testid={dataTestId ? `${dataTestId}-more-count` : undefined}
				>
					+{restCount}
				</div>
			)}
		</div>
	)
}

export default memo(MagicAvatarStack)
