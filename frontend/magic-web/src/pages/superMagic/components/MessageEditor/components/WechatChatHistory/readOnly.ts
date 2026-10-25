import type { Node } from "@/infrastructure/editors/tiptap/pm-model"
import i18next from "i18next"
import { parseWechatChat } from "../../extensions/wechat-chat-history/parser"

/** 消息列表沿用原 ProseMirror 及 mention NodeView；展开内容仍可原生选择、复制。 */
export function createWechatReadOnlyView(node: Node) {
	const snapshot = parseWechatChat(node.toJSON().content ?? [])
	const names = snapshot.participants
	const details = document.createElement("details")
	details.className = "my-2 rounded-lg border border-border bg-background p-3"
	const summary = document.createElement("summary")
	summary.className = "cursor-pointer text-sm font-medium"
	const title =
		names.length === 2
			? i18next.t("wechatChat.titlePair", { ns: "super", first: names[0], second: names[1] })
			: names.length > 2
				? i18next.t("wechatChat.titleGroup", {
						ns: "super",
						first: names[0],
						count: names.length,
					})
				: names.length
					? i18next.t("wechatChat.titleSingle", { ns: "super", name: names[0] })
					: i18next.t("wechatChat.title", { ns: "super" })
	summary.textContent = `${title} · ${i18next.t("wechatChat.messageCount", { ns: "super", count: snapshot.messages.length })}`
	const contentDOM = document.createElement("div")
	contentDOM.className = "mt-3 whitespace-pre-wrap text-sm"
	details.append(summary, contentDOM)
	return { dom: details, contentDOM }
}
