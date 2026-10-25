import { useCallback, useRef } from "react"
import { Modal } from "antd"
import { Checkbox } from "../../../primitives/shadcn/checkbox"
import { useCanvas } from "../../../../app/providers/CanvasProvider"
import { useCanvasDesignI18n } from "../../../../app/providers/I18nProvider"
import styles from "./index.module.css"
import {
	getShouldSkipVideoPointsConfirm,
	setShouldSkipVideoPointsConfirm,
} from "./points/video-points-confirm.storage"

interface ConfirmVideoGenerationOptions {
	points: number | null
	onConfirm: () => void | Promise<void>
}

export function useVideoPointsConfirm() {
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()
	const confirmingRef = useRef(false)

	return useCallback(
		async (options: ConfirmVideoGenerationOptions) => {
			const { points, onConfirm } = options
			if (getShouldSkipVideoPointsConfirm()) {
				await onConfirm()
				return
			}
			if (confirmingRef.current) return

			confirmingRef.current = true
			let shouldSkipNextConfirm = false
			const resetConfirming = () => {
				confirmingRef.current = false
			}
			const confirmOptions = {
				title: t("videoEditor.sendConfirmTitle", "消耗提示"),
				content: (
					<div
						className={styles.sendConfirmContent}
						data-testid="video-points-confirm-content"
					>
						<p className={styles.sendConfirmDescription}>
							{points == null
								? t(
										"videoEditor.sendConfirmUnknownPointsDescription",
										"本次任务将产生积分消耗，是否确认执行？",
									)
								: t("videoEditor.sendConfirmDescription", {
										defaultValue:
											"本次任务预计消耗约 {{points}} 积分，是否确认执行？",
										points,
									})}
						</p>
						<label className={styles.sendConfirmCheckboxRow}>
							<Checkbox
								data-testid="video-points-confirm-skip-checkbox"
								onCheckedChange={(checked) => {
									shouldSkipNextConfirm = checked === true
								}}
							/>
							<span className={styles.sendConfirmCheckboxLabel}>
								{t("videoEditor.sendConfirmSkip", "下次不再提示")}
							</span>
						</label>
					</div>
				),
				okText: t("videoEditor.sendConfirmOk", "确认执行"),
				okButtonProps: {
					"data-testid": "video-points-confirm-ok-button",
				},
				cancelButtonProps: {
					"data-testid": "video-points-confirm-cancel-button",
				},
				onOk: () => {
					setShouldSkipVideoPointsConfirm(shouldSkipNextConfirm)
					void Promise.resolve()
						.then(onConfirm)
						.finally(() => {
							resetConfirming()
						})
						.catch(() => undefined)
				},
				onCancel: () => {
					resetConfirming()
				},
			}
			const injectedConfirmModal = canvas?.magicConfigManager.config?.methods?.confirmModal
			if (injectedConfirmModal) {
				injectedConfirmModal(confirmOptions)
				return
			}
			Modal.confirm(confirmOptions)
		},
		[canvas, t],
	)
}
