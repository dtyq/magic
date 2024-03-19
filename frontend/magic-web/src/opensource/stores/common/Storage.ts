export function getStoragePrefixKey(key: string) {
	return `app:${key}`
}

/**
 * 实例化Session缓存
 * @returns {string|{set(*, *): void, get(*): string, clear(): void, length: number, remove(*): void, key(*): string}|void|*}
 */
const getSession = () => {
	const storage = window.sessionStorage
	return {
		get(key: string) {
			return storage.getItem(getStoragePrefixKey(key))
		},
		set(key: string, value: any) {
			return storage.setItem(getStoragePrefixKey(key), value)
		},
		remove(key: string) {
			return storage.removeItem(getStoragePrefixKey(key))
		},
		clear() {
			return storage.clear()
		},
		length: storage.length,
	}
}

/**
 * 实例化Local缓存
 * @returns {string|{set(*, *): void, get(*): string, clear(): void, length: number, remove(*): void, key(*): string}|void|*}
 */
const getLocal = () => {
	const storage = window.localStorage
	return {
		get(key: string) {
			return storage.getItem(getStoragePrefixKey(key))
		},
		set(key: string, value: any) {
			return storage.setItem(getStoragePrefixKey(key), value)
		},
		remove(key: string) {
			return storage.removeItem(getStoragePrefixKey(key))
		},
		clear() {
			return storage.clear()
		},
		length: storage.length,
	}
}

export const Session = getSession()
export const Local = getLocal()
