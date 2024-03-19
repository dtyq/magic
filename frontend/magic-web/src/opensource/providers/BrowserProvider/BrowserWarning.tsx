import { Modal, Typography } from "antd"
import MagicButton from "@/opensource/components/base/MagicButton"
import { useEffect, useState } from "react"
import { getBrowserInfo, MIN_SUPPORTED_VERSIONS } from "./browser"
import { StyleProvider, legacyLogicalPropertiesTransformer } from "@ant-design/cssinjs"
import { useTranslation } from "react-i18next"
import { logger as Logger } from "@/opensource/utils/log"
import ThemeProvider from "@/opensource/providers/ThemeProvider"

const logger = Logger.createLogger("browser")

const { Title, Paragraph } = Typography

interface BrowserWarningProps {
	onClose?: () => void
}

/**
 * Component that displays a warning modal for outdated browsers
 */
function BrowserWarning(props?: BrowserWarningProps) {
	const { t } = useTranslation("common")

	const [visible, setVisible] = useState(false)
	const [browserInfo, setBrowserInfo] = useState({ name: "", version: 0 })

	useEffect(() => {
		const { name, version, isOutdated } = getBrowserInfo()

		if (isOutdated) {
			logger.report("version low", {
				name,
				version,
			})
			setBrowserInfo({ name, version })
			setVisible(true)
		}
	}, [])

	if (!visible) return null

	return (
		<StyleProvider hashPriority="high" transformers={[legacyLogicalPropertiesTransformer]}>
			<ThemeProvider>
				<Modal
					title={t("browser.title")}
					open={visible}
					closable={false}
					maskClosable={false}
					keyboard={false}
					footer={[
						<MagicButton
							key="continue"
							type="primary"
							block
							onClick={() => {
								setVisible(false)
								props?.onClose?.()
							}}
						>
							{t("browser.confirm")}
						</MagicButton>,
					]}
					centered
				>
					<Typography>
						<Title level={5}>{t("browser.header")}</Title>
						<Paragraph>
							{t("browser.desc", {
								name: browserInfo.name,
								version: browserInfo.version,
							})}
						</Paragraph>
						<ul>
							<li>
								{t("browser.tip", {
									name: `Chrome ${MIN_SUPPORTED_VERSIONS.Chrome}`,
								})}
							</li>
							<li>
								{t("browser.tip", { name: `Edge ${MIN_SUPPORTED_VERSIONS.Edge}` })}
							</li>
							<li>
								{t("browser.tip", {
									name: `Firefox ${MIN_SUPPORTED_VERSIONS.Firefox}`,
								})}
							</li>
							<li>
								{t("browser.tip", {
									name: `Safari ${MIN_SUPPORTED_VERSIONS.Safari}`,
								})}
							</li>
						</ul>
						<Paragraph>{t("browser.warning")}</Paragraph>
					</Typography>
				</Modal>
			</ThemeProvider>
		</StyleProvider>
	)
}

export default BrowserWarning
