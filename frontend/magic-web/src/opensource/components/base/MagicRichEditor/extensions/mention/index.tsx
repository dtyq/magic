import Mention from "@tiptap/extension-mention"

const MentionExtension = Mention.extend({
	addAttributes() {
		return {
			type: {
				default: "user",
			},
			id: {
				default: "",
			},
			label: {
				default: "",
			},
			avatar: {
				default: "",
			},
		}
	},
})

export default MentionExtension
