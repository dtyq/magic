<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Utils\SimpleUpload;

class TosSigner
{
    private static string $emptyHashPayload = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    private static string $algorithm = 'TOS4-HMAC-SHA256';

    private static string $unsignedPayload = 'UNSIGNED-PAYLOAD';

    /**
     * @param array{"key": string, "headers": array, "method": string, "queries": array} $request
     * @param mixed $host
     * @param mixed $ak
     * @param mixed $sk
     * @param mixed $securityToken
     * @param mixed $region
     * @return array
     */
    public static function sign(array $request, $host, $ak, $sk, $securityToken, $region)
    {
        if (empty($request['headers'])) {
            $request['headers'] = [];
        }

        $request['headers']['Host'] = $host;

        $longDate = null;
        $shortDate = null;
        $credentialScope = null;
        self::prepareDateAndCredentialScope($longDate, $shortDate, $credentialScope, $region);

        if ($ak && $sk && $securityToken) {
            $request['headers']['x-tos-security-token'] = strval($securityToken);
        }
        $request['headers']['x-tos-date'] = $longDate;
        $signedHeaders = null;
        $canonicalRequest = self::getCanonicalRequest($request, '', $signedHeaders);

        if (! $ak || ! $sk) {
            return $request;
        }
        $stringToSign = self::getStringToSign($canonicalRequest, $longDate, $credentialScope);
        $signature = self::getSignature($stringToSign, $shortDate, $sk, $region);
        $request['headers']['Authorization'] = self::$algorithm
            . ' Credential=' . $ak . '/' . $credentialScope . ', SignedHeaders=' . $signedHeaders . ', Signature=' . $signature;
        return $request;
    }

    public static function urlencodeWithSafe($val, $safe = '/')
    {
        if (! $val) {
            return '';
        }

        if (($len = strlen($val)) === 0) {
            return '';
        }
        $buffer = [];
        for ($index = 0; $index < $len; ++$index) {
            $str = $val[$index];
            $buffer[] = ! ($pos = strpos($safe, $str)) && $pos !== 0 ? rawurlencode($str) : $str;
        }
        return implode('', $buffer);
    }

    protected static function prepareDateAndCredentialScope(&$longDate, &$shortDate, &$credentialScope, $region)
    {
        $longDate = gmdate('Ymd\THis\Z', time());
        $shortDate = substr($longDate, 0, 8);
        $credentialScope = $shortDate . '/' . $region . '/tos/request';
    }

    private static function getSignature($stringToSign, $shortDate, $sk, $region)
    {
        $dateKey = hash_hmac('sha256', $shortDate, $sk, true);
        $regionKey = hash_hmac('sha256', $region, $dateKey, true);
        $serviceKey = hash_hmac('sha256', 'tos', $regionKey, true);
        $signingKey = hash_hmac('sha256', 'request', $serviceKey, true);
        return hash_hmac('sha256', $stringToSign, $signingKey);
    }

    private static function getStringToSign($canonicalRequest, $longDate, $credentialScope): string
    {
        $stringToSign = self::$algorithm . "\n" . $longDate . "\n" . $credentialScope . "\n";
        $stringToSign .= hash('sha256', $canonicalRequest);
        return $stringToSign;
    }

    /**
     * @param array{"key": string, "headers": array, "method": string, "queries": array} $request
     * @param mixed $canonicalHeaders
     * @param mixed $signedHeaders
     * @param mixed $query
     * @param mixed $contentSha256
     */
    private static function getCanonicalRequest(array $request, $canonicalHeaders = '', &$signedHeaders = '', $query = false, $contentSha256 = ''): string
    {
        $canonicalRequest = strtoupper($request['method']) . "\n";
        $canonicalRequest .= '/';
        if (! empty($request['key'])) {
            $canonicalRequest .= self::urlencodeWithSafe($request['key']);
        }
        $canonicalRequest .= "\n";

        if (is_array($request['queries'])) {
            ksort($request['queries']);
            $index = 0;
            foreach ($request['queries'] as $key => $val) {
                $encodedKey = rawurlencode($key);
                $val = rawurlencode(strval($val));
                $request['queries'][$key] = $val;
                $canonicalRequest .= $encodedKey . '=' . $val;
                if ($index !== count($request['queries']) - 1) {
                    $canonicalRequest .= '&';
                }
                ++$index;
            }
        }
        $canonicalRequest .= "\n";

        if ($canonicalHeaders && $signedHeaders) {
            $canonicalRequest .= $canonicalHeaders;
            $canonicalRequest .= "\n";
        } else {
            $signedHeaders = '';
            $headers = [];
            foreach ($request['headers'] as $key => $val) {
                $headers[strtolower($key)] = $val;
            }
            ksort($headers);
            foreach ($headers as $key => $val) {
                if ($key !== 'host' && $key !== 'content-type'
                    && strpos($key, 'x-tos-') !== 0) {
                    continue;
                }

                $signedHeaders .= $key . ';';
                $canonicalRequest .= $key . ':' . trim(strval($val)) . "\n";
            }
            $canonicalRequest .= "\n";
            $signedHeaders = substr($signedHeaders, 0, strlen($signedHeaders) - 1);
        }

        $canonicalRequest .= $signedHeaders;
        $canonicalRequest .= "\n";

        if ($contentSha256) {
            $canonicalRequest .= $contentSha256;
        } elseif ($query) {
            $canonicalRequest .= self::$unsignedPayload;
        } else {
            $canonicalRequest .= self::$emptyHashPayload;
        }
        return $canonicalRequest;
    }
}
