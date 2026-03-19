import type React from "react"
import { useState } from "react"
import { Input, Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import { IconFileUpload } from "@tabler/icons-react"
import MagicModal from "@/components/base/MagicModal"
import { useTheme } from "antd-style"
import magicToast from "@/components/base/MagicToaster/utils"

interface CurlImporterProps {
	visible: boolean
	onCancel: () => void
	onImport: (curlCommand: string) => void
	onShow: () => void
}

const CurlImporter: React.FC<CurlImporterProps> = ({ visible, onCancel, onImport, onShow }) => {
	const { t } = useTranslation()
	const [curlCommand, setCurlCommand] = useState("")
	const { magicColorScales } = useTheme()

	const handleImport = () => {
		if (!curlCommand.trim()) {
			magicToast.error(t("http.curlImport.emptyError", { ns: "flow" }))
			return
		}

		try {
			onImport(curlCommand)
			setCurlCommand("")
		} catch (error) {
			console.error("解析 curl 命令失败", error)
			magicToast.error(t("http.curlImport.parseError", { ns: "flow" }))
		}
	}

	return (
		<>
			<Tooltip title={t("http.curlImport.buttonText", { ns: "flow" })}>
				<IconFileUpload
					size={20}
					onClick={onShow}
					color={magicColorScales.brand[5]}
					style={{ cursor: "pointer" }}
				/>
			</Tooltip>

			<MagicModal
				title={t("http.curlImport.modalTitle", { ns: "flow" })}
				open={visible}
				onCancel={onCancel}
				cancelText={t("button.cancel", { ns: "interface" })}
				okText={t("http.curlImport.import", { ns: "flow" })}
				onOk={handleImport}
			>
				<p>{t("http.curlImport.pastePrompt", { ns: "flow" })}</p>
				<Input.TextArea
					rows={6}
					value={curlCommand}
					onChange={(e) => setCurlCommand(e.target.value)}
					placeholder={t("http.curlImport.placeholder", { ns: "flow" })}
				/>
				<p style={{ marginTop: 8, fontSize: 12, color: "#999" }}>
					{t("http.curlImport.supportInfo", { ns: "flow" })}
				</p>
			</MagicModal>
		</>
	)
}

export default CurlImporter
