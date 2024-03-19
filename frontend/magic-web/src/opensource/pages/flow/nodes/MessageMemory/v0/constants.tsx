import { IconFile, IconPhoto, IconTextSize } from "@tabler/icons-react"
import type { TFunction } from "i18next"

/**
 * 消息类型枚举
 */
export enum MessageType {
	// 文本
	Text = "text",
	// 图片
	Image = "img",
	// 文件
	File = "file",
}

export const getMessageTypeOptions = (styles: any, t: TFunction) => {
	return [
		{
			label: (
				<div className={styles.label}>
					<IconTextSize color="#000000" stroke={1} className={styles.icon} />
					<span>{t("reply.text", { ns: "flow" })}</span>
				</div>
			),
			realLabel: t("reply.text", { ns: "flow" }),
			value: MessageType.Text,
		},
		{
			label: (
				<div className={styles.label}>
					<IconPhoto color="#3A57D1" stroke={1} className={styles.icon} />
					<span>{t("reply.image", { ns: "flow" })}</span>
				</div>
			),
			realLabel: t("reply.image", { ns: "flow" }),
			value: MessageType.Image,
		},
		{
			label: (
				<div className={styles.label}>
					<IconFile color="#A61CCB" stroke={1} className={styles.icon} />
					<span>{t("reply.fileCard", { ns: "flow" })}</span>
				</div>
			),
			realLabel: t("reply.fileCard", { ns: "flow" }),
			value: MessageType.File,
		},
	]
}

export default {}
