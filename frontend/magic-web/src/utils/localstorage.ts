export default {
	get(key: string, toObject: boolean = false) {
		const value = localStorage.getItem(key)

		if (toObject) {
			try {
				return JSON.parse(value ?? "{}")
			} catch (error) {
				console.error(error)
				return {}
			}
		}

		return value
	},

	set(key: string, value: any) {
		localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value))
	},

	remove(key: string) {
		localStorage.removeItem(key)
	},
}
