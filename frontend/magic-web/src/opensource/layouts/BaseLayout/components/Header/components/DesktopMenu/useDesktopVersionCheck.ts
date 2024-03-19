import { useState } from "react"
import { useAsyncEffect } from "ahooks"
import { magic } from "@/opensource/enhance/magicElectron"
import { compareVersions } from "@/opensource/lib/dingTalkAPI"

export function useDesktopVersionCheck() {
	const [version, setAppVisible] = useState("")

	useAsyncEffect(async () => {
		try {
			const { appVersion } = (await magic?.os?.getSystemInfo?.()) || {}

			setAppVisible(appVersion)
		} catch (error) {
			console.error(error)
		}
	}, [])

	return {
		isHighVersion: compareVersions(version, "0.0.17") > 0,
	}
}
