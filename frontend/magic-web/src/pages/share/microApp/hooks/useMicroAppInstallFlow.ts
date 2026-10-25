import { useCallback, useEffect, useMemo, useState } from "react"
import { clipboard } from "@/utils/clipboard-helpers"
import {
	microAppSharePasswordStore,
	rememberMicroAppShareResource,
} from "../utils/microAppSharePasswordStore"
import { buildExternalBrowserUrl, type MicroAppInstallDialogMode } from "./microAppInstall"
import useMicroAppInstall from "./useMicroAppInstall"

interface UseMicroAppInstallFlowOptions {
	appId: string
	hasEntryFile: boolean
	hasError: boolean
	hasShareData: boolean
	isLoading: boolean
	isNeedPassword: boolean
	resourceId: string
	safetyConfirmed: boolean
	verifiedPassword?: string
}

async function copyText(text: string): Promise<boolean> {
	try {
		await clipboard.writeText(text)
		return true
	} catch {
		return false
	}
}

export default function useMicroAppInstallFlow({
	appId,
	hasEntryFile,
	hasError,
	hasShareData,
	isLoading,
	isNeedPassword,
	resourceId,
	safetyConfirmed,
	verifiedPassword,
}: UseMicroAppInstallFlowOptions) {
	const { environment, prompt, status } = useMicroAppInstall(appId)
	const [dialogOpen, setDialogOpen] = useState(false)
	const [rememberPassword, setRememberPassword] = useState(false)
	const [linkCopied, setLinkCopied] = useState(false)
	const [storageRevision, setStorageRevision] = useState(0)

	useEffect(() => {
		setDialogOpen(false)
		setRememberPassword(false)
		setLinkCopied(false)
	}, [appId])

	const rememberedPassword = useMemo(() => {
		void storageRevision
		return resourceId ? microAppSharePasswordStore.read(resourceId)?.password : undefined
	}, [resourceId, storageRevision])
	const needsPasswordConfirmation = Boolean(
		isNeedPassword && verifiedPassword && rememberedPassword !== verifiedPassword,
	)
	const dialogMode: MicroAppInstallDialogMode = environment.isEmbeddedWebView
		? "webview"
		: status === "ios-manual"
			? "ios"
			: "browser"
	const environmentSupported =
		environment.isEmbeddedWebView || status === "available" || status === "ios-manual"
	const showInstall = Boolean(
		!isLoading &&
		!hasError &&
		hasShareData &&
		hasEntryFile &&
		safetyConfirmed &&
		environmentSupported &&
		status !== "installed",
	)

	const savePassword = useCallback(
		(password = verifiedPassword) => {
			if (!rememberPassword || !password) return
			microAppSharePasswordStore.save(resourceId, password)
			rememberMicroAppShareResource(appId, resourceId)
			setStorageRevision((revision) => revision + 1)
		},
		[appId, rememberPassword, resourceId, verifiedPassword],
	)
	const handleInstall = useCallback(() => {
		if (environment.isEmbeddedWebView || status === "ios-manual" || needsPasswordConfirmation) {
			setRememberPassword(false)
			setLinkCopied(false)
			setDialogOpen(true)
			return
		}
		void prompt()
	}, [environment.isEmbeddedWebView, needsPasswordConfirmation, prompt, status])
	const handleConfirm = useCallback(() => {
		savePassword()
		setDialogOpen(false)
		setRememberPassword(false)
		if (status === "available") void prompt()
	}, [prompt, savePassword, status])
	const handleCopyLink = useCallback(async () => {
		savePassword()
		setLinkCopied(await copyText(window.location.href))
	}, [savePassword])
	const handleOpenBrowser = useCallback(() => {
		savePassword()
		void copyText(window.location.href)
		const externalUrl = buildExternalBrowserUrl(window.location.href, navigator.userAgent)
		if (externalUrl.startsWith("intent://")) {
			window.location.assign(externalUrl)
			return
		}
		window.open(externalUrl, "_blank", "noopener,noreferrer")
	}, [savePassword])

	return {
		showInstall,
		handleInstall,
		rememberVerifiedPassword: savePassword,
		rememberPasswordControl: {
			enabled: true,
			checked: rememberPassword,
			onCheckedChange: setRememberPassword,
		},
		dialog: {
			mode: dialogMode,
			open: dialogOpen,
			canRememberPassword: needsPasswordConfirmation,
			rememberPassword,
			linkCopied,
			onOpenChange: setDialogOpen,
			onRememberPasswordChange: setRememberPassword,
			onConfirm: handleConfirm,
			onCopyLink: handleCopyLink,
			onOpenBrowser: handleOpenBrowser,
		},
	}
}
