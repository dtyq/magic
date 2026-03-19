import { magic } from "@/enhance/magicElectron"
import { useEffect } from "react"

interface MagicElectronViewHookProps {
	onShow?: () => void
	onHide?: () => void
}

export default function useView(props: MagicElectronViewHookProps) {
	const { onShow, onHide } = props

	useEffect(() => {
		const unSubscribe = magic?.view?.onShow?.(() => {
			onShow?.()
		})
		window.addEventListener("beforeunload", unSubscribe)
		return () => {
			window.removeEventListener("beforeunload", unSubscribe)
			unSubscribe?.()
		}
	}, [onShow])

	useEffect(() => {
		const unSubscribe = magic?.view?.onHide?.(() => {
			onHide?.()
		})
		window.addEventListener("beforeunload", unSubscribe)
		return () => {
			window.removeEventListener("beforeunload", unSubscribe)
			unSubscribe?.()
		}
	}, [onHide])
}
