import React from "react"
import { Spin } from "antd"
import { getLocalizedText } from "../utils/i18n"

interface PlayerStatesProps {
	fileUrl?: string
	fileId?: string
	isLoading: boolean
	playerReady: boolean
	loadingOverlayClassName: string
	placeholderClassName: string
}

export function PlayerStates({
	fileUrl,
	fileId,
	isLoading,
	playerReady,
	loadingOverlayClassName,
	placeholderClassName,
}: PlayerStatesProps) {
	// Loading overlay for when player is ready but loading content
	if (fileUrl && isLoading) {
		return (
			<div className={loadingOverlayClassName}>
				<Spin size="large" />
			</div>
		)
	}

	// Error state for when player failed to load
	if (fileUrl && !isLoading && !playerReady) {
		return (
			<div className={loadingOverlayClassName}>
				<div style={{ color: "#fff", textAlign: "center" }}>
					<div>{getLocalizedText("loadFailed")}</div>
					<div style={{ fontSize: "12px", marginTop: "8px" }}>
						{getLocalizedText("checkFormat")}
					</div>
				</div>
			</div>
		)
	}

	// Loading state for when fetching file URL
	if (!fileUrl && fileId) {
		return (
			<div className={placeholderClassName}>
				<Spin size="large" />
				<div style={{ color: "#fff", marginTop: "16px" }}>
					{getLocalizedText("loading")}
				</div>
			</div>
		)
	}

	// Invalid file state
	if (!fileUrl && !fileId) {
		return (
			<div className={placeholderClassName}>
				<div style={{ color: "#fff", textAlign: "center" }}>
					<div>{getLocalizedText("invalidFile")}</div>
					<div style={{ fontSize: "12px", marginTop: "8px" }}>
						{getLocalizedText("fileIdNotFound")}
					</div>
				</div>
			</div>
		)
	}

	return null
}
