class AvatarStore {
	map: Map<any, any>
	constructor() {
		this.map = new Map()
	}

	init(array: { text: string; base64: string }[]) {
		array.forEach((item) => {
			this.map.set(item.text, item.base64)
		})
	}

	/**
	 * 获取文本头像
	 * @param text
	 * @returns
	 */
	getTextAvatar(text: string) {
		return this.map.get(text)
	}

	setTextAvatar(text: string, base64: string) {
		this.map.set(text, base64)
	}
}

export default new AvatarStore()
