const MANIFEST_ICON_SIZES = [192, 512]
const SUPPORTED_ICON_SIZES = [180, 192, 512]
const APPLE_TOUCH_ICON_SIZE = 180
const FAVICON_ICON_SIZE = 192
const DEFAULT_ICON_QUERY_SIZE = 512
const ICON_SVG_CONTENT_TYPE = "image/svg+xml"
const BUILTIN_DEFAULT_ICON_KEY = "builtin-default"
const MANIFEST_FILENAME = "manifest.webmanifest"
const MICRO_APP_INSTALL_SCOPE = "/micro-app/"

function encodeMicroAppId(appId) {
	return encodeURIComponent(appId)
}

function buildMicroAppBasePath(appId) {
	return `${MICRO_APP_INSTALL_SCOPE}${encodeMicroAppId(appId)}`
}

function buildMicroAppInstallScope(appId) {
	// Match page route /micro-app/:appId (no trailing slash).
	return buildMicroAppBasePath(appId)
}

function buildInstallIconPath(appId) {
	return `${buildMicroAppBasePath(appId)}/icon`
}

function buildInstallIconUrl(appId, size) {
	return `${buildInstallIconPath(appId)}?size=${size}`
}

function buildManifestUrl(appId) {
	return `${buildMicroAppBasePath(appId)}/${MANIFEST_FILENAME}`
}

function buildManifestIcons(appId) {
	const iconPath = buildInstallIconPath(appId)
	return MANIFEST_ICON_SIZES.map((size) => ({
		src: `${iconPath}?size=${size}`,
		sizes: `${size}x${size}`,
		type: ICON_SVG_CONTENT_TYPE,
	}))
}

module.exports = {
	APPLE_TOUCH_ICON_SIZE,
	BUILTIN_DEFAULT_ICON_KEY,
	DEFAULT_ICON_QUERY_SIZE,
	FAVICON_ICON_SIZE,
	ICON_SVG_CONTENT_TYPE,
	MANIFEST_FILENAME,
	MANIFEST_ICON_SIZES,
	MICRO_APP_INSTALL_SCOPE,
	SUPPORTED_ICON_SIZES,
	buildInstallIconPath,
	buildInstallIconUrl,
	buildManifestIcons,
	buildManifestUrl,
	buildMicroAppInstallScope,
	buildMicroAppBasePath,
	encodeMicroAppId,
}
