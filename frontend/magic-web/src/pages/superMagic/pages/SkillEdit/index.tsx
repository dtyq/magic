import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"
import { lazy } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"

const SkillEditDesktopPage = lazy(() => import("./index.desktop"))
const SkillEditMobilePage = lazy(() => import("./index.mobile"))

function SkillEditPage() {
	const isMobile = useIsMobile()

	if (isMobile) return <SkillEditMobilePage />

	return <SkillEditDesktopPage />
}

export default function FileAccessPage() {
	return (
		<FileAccessProvider>
			<SkillEditPage />
		</FileAccessProvider>
	)
}
