import pubsub, { PubSubEvents } from "@/utils/pubsub"

export const getBaseContent = (data: any) => {
	const { attachmentList, file_id, t } = data
	const currentFile = attachmentList?.find((item: any) => item.file_id === file_id)

	if (!currentFile) {
		return null
	}

	return {
		type: "paragraph",
		attrs: {
			suggestion: "",
		},
		content: [
			{
				type: "text",
				text: t("topicFiles.fileModify"),
			},
			{
				type: "mention",
				attrs: {
					id: null,
					label: null,
					mentionSuggestionChar: "@",
					type: "project_file",
					data: {
						file_id: currentFile?.file_id,
						file_name: currentFile?.file_name,
						file_path: currentFile?.relative_file_path,
						file_extension: currentFile?.file_extension,
					},
				},
			},
			{
				type: "text",
				text: t("topicFiles.fileModifyElements"),
			},
		],
	}
}

export const insertContentToChat = (data: any) => {
	const { baseContent, extraContentData, t, payload } = data
	const { action } = payload
	const { extraContent, extraData } = extraContentData

	let prompt = ""
	switch (action) {
		case "factCheck":
			prompt = t("topicFiles.factCheckPrompt")
			break
		case "contentTranslation":
			prompt = t("topicFiles.contentTranslationPrompt")
			break
		case "dataCorrection":
			prompt = t("topicFiles.dataCorrectionPrompt")
			break
		case "layoutCorrection":
			prompt = t("topicFiles.layoutCorrectionPrompt")
			break
		case "custom":
			prompt = ""
			break
		default:
			prompt = ""
			break
	}

	const contentData = [
		baseContent,
		{
			type: "paragraph",
			content: extraContent,
		},
	]

	// 其他动作包含完整的内容和prompt
	if (!["custom"].includes(action)) {
		contentData.push({
			type: "paragraph",
			content: prompt
				? [
					{
						type: "text",
						text: prompt,
					},
				]
				: [],
		})
	}

	if (action === "contentTranslation") {
		contentData.push({
			type: "super-placeholder",
			attrs: {
				type: "input",
				props: {
					placeholder: t("topicFiles.contentTranslationPlaceholder"),
					defaultValue: "",
					value: "",
				},
			},
		})
	}
	if (action === "layoutCorrection") {
		contentData.push({
			type: "super-placeholder",
			attrs: {
				type: "input",
				props: {
					placeholder: t("topicFiles.questPlaceholder"),
					defaultValue: "",
					value: "",
				},
			},
		})
	}
	if (action === "custom") {
		contentData.push({
			type: "super-placeholder",
			attrs: {
				type: "input",
				props: {
					placeholder: t("topicFiles.customPlaceholder"),
					defaultValue: "",
					value: "",
				},
			},
		})
	}
	pubsub.publish(PubSubEvents.Add_Content_To_Chat, {
		content: {
			type: "doc",
			content: contentData,
		},
		extraData,
	})
}
const getExtraContent = (data: any) => {
	const { t } = data
	const { action, elementInfo } = data.payload || {}
	let text = ""
	const innerText = elementInfo?.innerText?.replace(/\n/g, "")
	const truncatedText =
		innerText && innerText.length > 100
			? innerText.substring(0, 50) +
			`...${t("topicFiles.textOmitted")}...` +
			innerText.substring(innerText.length - 50, innerText.length)
			: innerText
	if (action === "factCheck") {
		text = `\`\`\`\n${t("topicFiles.elementText")}${truncatedText} \n${t(
			"topicFiles.elementSelector",
		)}${elementInfo.jsPath} \n \`\`\``
	} else if (action === "contentTranslation") {
		text = ` \`\`\`\n${t("topicFiles.elementText")}${truncatedText} \n${t(
			"topicFiles.elementSelector",
		)}${elementInfo.jsPath} \n \`\`\` `
	} else if (action === "dataCorrection") {
		text = ` \`\`\`\n${t("topicFiles.elementText")}${truncatedText} \n${t(
			"topicFiles.elementSelector",
		)}${elementInfo.jsPath} \n \`\`\``
	} else if (action === "layoutCorrection") {
		text = ` \`\`\`\n${t("topicFiles.elementText")}${truncatedText} \n${t(
			"topicFiles.elementSelector",
		)}${elementInfo.jsPath} \n \`\`\``
	} else {
		text = ` \`\`\`\n${t("topicFiles.elementText")}${truncatedText} \n${t(
			"topicFiles.elementSelector",
		)}${elementInfo.jsPath} \n \`\`\``
	}
	const extraContent = [
		{
			type: "text",
			text,
		},
	]
	return {
		extraContent,
		extraData: {
			hasInput: ["contentTranslation", "layoutCorrection", "custom"].includes(action),
		},
	}
}

export function addContentToChat(data: any) {
	const { payload } = data
	const baseContent = getBaseContent(data)
	const extraContentData = getExtraContent(data)
	insertContentToChat({
		baseContent,
		extraContentData,
		payload,
		t: data?.t,
	})
}
