import { useEffect, useMemo, useState } from "react"
import type { CSSProperties } from "react"
import type { MyCrewView } from "@/services/crew/CrewService"

interface MyCrewAvatarProps {
	employee: Pick<MyCrewView, "name" | "icon" | "agentCode">
	sizeClassName: string
	fallbackTextClassName: string
	className?: string
	style?: CSSProperties
	testId?: string
}

const MY_CREW_FALLBACK_COLORS = ["#6366f1", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"]

/** 为无头像员工生成稳定的彩色底图，避免列表出现大量同质化黑色默认头像。 */
function resolveAvatarBackground(agentCode: string) {
	let seed = 0
	for (const char of agentCode) {
		seed = (seed * 31 + char.charCodeAt(0)) % MY_CREW_FALLBACK_COLORS.length
	}
	return MY_CREW_FALLBACK_COLORS[seed]
}

/** 从员工名称提取最多两个首字，保证无图时仍有可辨识的头像占位。 */
function resolveAvatarInitials(name: string, agentCode: string) {
	const trimmedName = name.trim()
	if (!trimmedName) return agentCode.slice(0, 2).toUpperCase()

	const nameParts = trimmedName
		.split(/[\s-_]+/)
		.map((part) => part.trim())
		.filter(Boolean)

	if (nameParts.length >= 2) {
		return `${nameParts[0][0] ?? ""}${nameParts[1][0] ?? ""}`.toUpperCase()
	}

	const compactName = trimmedName.replace(/\s+/g, "")
	return compactName.slice(0, 2).toUpperCase()
}

/** 统一渲染员工头像，远端图片失败时回退到更接近原型语义的彩底 initials。 */
export default function MyCrewAvatar({
	employee,
	sizeClassName,
	fallbackTextClassName,
	className,
	style,
	testId,
}: MyCrewAvatarProps) {
	const avatarUrl = typeof employee.icon === "string" ? employee.icon.trim() : ""
	const displayName = employee.name?.trim() || ""
	const agentCode = employee.agentCode?.trim() || "crew"
	const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
	const showRemoteAvatar = Boolean(avatarUrl) && !avatarLoadFailed
	const fallbackInitials = useMemo(
		() => resolveAvatarInitials(displayName, agentCode),
		[agentCode, displayName],
	)
	const fallbackBackground = useMemo(() => resolveAvatarBackground(agentCode), [agentCode])

	useEffect(() => {
		setAvatarLoadFailed(false)
	}, [avatarUrl])

	return (
		<div className={`flex items-center justify-center ${className ?? ""}`} style={style} data-testid={testId}>
			{showRemoteAvatar ? (
				<img
					src={avatarUrl}
					alt={displayName}
					className="h-full w-full object-cover"
					loading="lazy"
					decoding="async"
					onError={() => setAvatarLoadFailed(true)}
				/>
			) : (
				<div
					className="flex h-full w-full items-center justify-center"
					style={{ backgroundColor: fallbackBackground }}
				>
					<span className={fallbackTextClassName}>{fallbackInitials}</span>
				</div>
			)}
		</div>
	)
}
