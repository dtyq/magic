import { platformKey } from "@/opensource/utils/storage"

function generateStorage() {
	const storage = window.localStorage
	return {
		get(key: string) {
			try {
				return JSON.parse(storage.getItem(platformKey(key)) || "{}")
			} catch (error) {
				console.error(error)
				return storage.getItem(platformKey(key))
			}
		},
		set(key: string, value: any) {
			try {
				return storage.setItem(platformKey(key), JSON.stringify(value))
			} catch (error) {
				console.error(error)
				return storage.setItem(platformKey(key), value)
			}
		},
		remove(key: string) {
			return storage.removeItem(platformKey(key))
		},
		allClear() {
			return storage.clear()
		},
		key(index: number) {
			return storage.key(index)
		},
		getAll<T>(prefixKey: string): Array<T> {
			const list: Array<T> = []
			for (let i = 0; i < Storage.length; i++) {
				const key = Storage.key(i)
				if (key?.startsWith(platformKey(prefixKey))) {
					list.push(Storage.get(platformKey(prefixKey)))
				}
			}
			return list
		},
		clearById(prefixKey: string) {
			for (let i = 0; i < Storage.length; i++) {
				const key = Storage.key(i)
				if (key?.startsWith(platformKey(prefixKey))) {
					Storage.remove(platformKey(prefixKey))
				}
			}
		},
		length: storage.length,
	}
}

export const Storage = generateStorage()
