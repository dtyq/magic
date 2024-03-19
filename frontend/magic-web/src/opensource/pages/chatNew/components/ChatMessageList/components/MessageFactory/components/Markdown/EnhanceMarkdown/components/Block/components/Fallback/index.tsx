import StreamingPlaceholder from "@/opensource/pages/chatNew/components/ChatMessageList/components/MessageFactory/components/Markdown/EnhanceMarkdown/components/StreamingPlaceholder"
import { useTranslation } from "react-i18next"

const Fallback = () => {
	const { t } = useTranslation("interface")

	return <StreamingPlaceholder tip={t("chat.oss_file.loading")} />
}

export default Fallback
