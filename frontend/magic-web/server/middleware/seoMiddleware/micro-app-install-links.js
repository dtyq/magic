const {
	APPLE_TOUCH_ICON_SIZE,
	FAVICON_ICON_SIZE,
	buildInstallIconUrl,
	buildManifestUrl,
} = require("../../utils/microAppInstallConstants")

function buildInstallLinks(routeOptions, appId) {
	if (!routeOptions.installable || !appId) return {}

	return {
		manifestUrl: buildManifestUrl(appId),
		appleTouchIconUrl: buildInstallIconUrl(appId, APPLE_TOUCH_ICON_SIZE),
		// Reuse install icon route: app icon.svg first, platform favicon fallback.
		faviconUrl: buildInstallIconUrl(appId, FAVICON_ICON_SIZE),
	}
}

module.exports = buildInstallLinks
