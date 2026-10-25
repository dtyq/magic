import { FolderHeart } from "lucide-react"

interface MySlidesTemplatesTabIconProps {
	className?: string
}

export default function MySlidesTemplatesTabIcon({
	className = "size-4 shrink-0",
}: MySlidesTemplatesTabIconProps) {
	return (
		<FolderHeart
			className={className}
			aria-hidden="true"
			data-testid="my-slides-templates-tab-icon"
		/>
	)
}
