const fs = require("node:fs")
const path = require("node:path")
const { ICON_SVG_CONTENT_TYPE } = require("./microAppInstallConstants")

const DEFAULT_INSTALL_ICON_PATH = path.join(__dirname, "../assets/default-install-icon.svg")

const defaultInstallIconBody = fs.readFileSync(DEFAULT_INSTALL_ICON_PATH)

const defaultInstallIcon = {
	body: defaultInstallIconBody,
	contentType: ICON_SVG_CONTENT_TYPE,
}

module.exports = defaultInstallIcon
module.exports.DEFAULT_INSTALL_ICON_PATH = DEFAULT_INSTALL_ICON_PATH
