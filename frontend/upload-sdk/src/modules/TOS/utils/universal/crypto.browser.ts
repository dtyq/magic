import cryptoEncBase64 from "crypto-js/enc-base64"
import cryptoEncHex from "crypto-js/enc-hex"
import cryptoEncUtf8 from "crypto-js/enc-utf8"
import cryptoHmacSha256 from "crypto-js/hmac-sha256"
import cryptoHashMd5 from "crypto-js/md5"
import cryptoHashSha256 from "crypto-js/sha256"
import TosClientError from "../TosClientError"
import { isBuffer } from "../utils"

function getEnc(coding: "utf-8" | "base64" | "hex") {
	switch (coding) {
		case "utf-8":
			return cryptoEncUtf8
		case "base64":
			return cryptoEncBase64
		case "hex":
			return cryptoEncHex
		default:
			throw new TosClientError("The coding is not supported")
	}
}

function decode(v: any, decoding?: "base64" | "hex"): string {
	if (!decoding) {
		return v
	}

	return v.toString(getEnc(decoding))
}

export const hmacSha256 = function hmacSha256(
	key: string,
	message: string,
	decoding?: "base64" | "hex",
) {
	return decode(cryptoHmacSha256(message, key), decoding)
}

export const hashSha256 = function hashSha256(message: string, decoding?: "base64" | "hex") {
	return decode(cryptoHashSha256(message), decoding)
}

export const hashMd5 = function hashMd5(message: string | Buffer, decoding?: "base64" | "hex") {
	if (isBuffer(message)) {
		throw new TosClientError("not support buffer in browser environment")
	}

	return decode(cryptoHashMd5(message), decoding)
}

export const parse = function parse(str: string, encoding: "utf-8" | "base64" | "hex") {
	return getEnc(encoding).parse(str)
}

export const stringify = function stringify(
	str: CryptoJS.lib.WordArray,
	decoding: "utf-8" | "base64" | "hex",
) {
	return getEnc(decoding).stringify(str)
}
