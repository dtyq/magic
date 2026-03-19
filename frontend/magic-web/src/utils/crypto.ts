// eslint-disable-next-line import/no-duplicates
import sha256 from "crypto-js/sha256"
// eslint-disable-next-line import/no-duplicates
import md5 from "crypto-js/sha256"

export default {
	SHA256encryption(content: string) {
		return sha256(content).toString()
	},
	MD5encryption(content: string) {
		return md5(content).toString()
	},
}
