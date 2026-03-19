import { useEffect } from "react"
import { useIOSKeyboard } from "./useIOSKeyboard"
import type { MonitorSoftKeyboardResult } from "./useIOSKeyboard.types"

type MonitorSoftKeyboardAction = {
	/**
	 * 软键盘是否收起
	 */
	isDown?: boolean
	/**
	 * 软键盘是否弹起
	 */
	isUp?: boolean
	/**
	 * 软键盘高度差 (iOS) 或偏移量 (Android)
	 */
	heightDifference?: number
}

type Props = {
	/**
	 * 监听软键盘弹起或收起的回调
	 * @param params
	 * @returns
	 */
	callback?: (params?: MonitorSoftKeyboardAction) => void
	/**
	 * 差值范围，默认 20，兼容IOS可用
	 */
	differenceRange?: number // 差值范围，默认 20，兼容IOS可用
}

/**
 * 监听 H5软键盘弹起 & 收起事件
 * Enhanced version using Visual Viewport API for better iOS and Android Chrome support
 * @param props
 * @returns
 */
const useMonitorSoftKeyboard = ({ callback }: Props = {}): MonitorSoftKeyboardResult => {
	const keyboardState = useIOSKeyboard()

	const {
		isUp,
		offset,
		isIOSDevice,
		isAndroidDevice,
		isChromeOrChromiumBrowser,
		needsKeyboardHandling,
	} = keyboardState

	const isDown = !isUp

	// Call callback when keyboard state changes
	useEffect(() => {
		if (needsKeyboardHandling) {
			callback?.({
				isDown,
				isUp,
				heightDifference: offset,
			})
		}
	}, [isDown, isUp, offset, callback, needsKeyboardHandling])

	return {
		isUp,
		isDown,
		offset,
		isIOSDevice,
		isAndroidDevice,
		isChromeOrChromiumBrowser,
		needsKeyboardHandling,
	}
}

export default useMonitorSoftKeyboard
