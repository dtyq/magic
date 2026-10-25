import { FileAccessProvider } from "@/pages/superMagic/providers/FileAccessProvider"
import { useIsMobile } from "@/hooks/useIsMobile"
import AudioRecordingEntryPage from "@/pages/superMagicMobile/pages/AudioRecordingEntry"

import AudioRecordingsPageDesktop from "./index.desktop"

/**
 * Shared /recordings route entry: desktop keeps the existing list UI,
 * mobile viewport renders the new H5 quick-entry shell.
 */
function AudioRecordingsPage() {
	const isMobile = useIsMobile()

	if (isMobile) return <AudioRecordingEntryPage />

	return <AudioRecordingsPageDesktop />
}

export default function FileAccessPage() {
	return (
		<FileAccessProvider>
			<AudioRecordingsPage />
		</FileAccessProvider>
	)
}
