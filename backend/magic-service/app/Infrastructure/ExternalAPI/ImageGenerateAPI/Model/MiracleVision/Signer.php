<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\MiracleVision;

use DateTime;
use DateTimeZone;
use GuzzleHttp\Psr7\Request;

const BasicDateFormat = 'Ymd\THis\Z';
const Algorithm = 'SDK-HMAC-SHA256';
const HeaderXDate = 'X-Sdk-Date';
const HeaderHost = 'Host';
const HeaderAuthorization = 'Authorization';
const HeaderContentSha256 = 'Content-SHA256';

class Signer
{
    private string $key;

    private string $secret;

    public function __construct(string $key, string $secret)
    {
        $this->key = $key;
        $this->secret = $secret;
    }

    public function getSignedRequest(string $url, string $method, array $headers, string $body): Request
    {
        $dt = $headers[HeaderXDate] ?? '';
        if (empty($dt)) {
            $t = new DateTime('now', new DateTimeZone('UTC'));
            $headers[HeaderXDate] = $t->format(BasicDateFormat);
        } else {
            $t = DateTime::createFromFormat(BasicDateFormat, $dt, new DateTimeZone('UTC'));
        }

        $signedHeaders = $this->signedHeaders($headers);
        $canonicalRequest = $this->canonicalRequest($method, $url, $headers, $body, $signedHeaders);
        $stringToSign = $this->stringToSign($canonicalRequest, $t->format(BasicDateFormat));
        $signature = $this->signStringToSign($stringToSign, $this->secret);
        $authValue = $this->authHeaderValue($signature, $this->key, $signedHeaders);

        $headers[HeaderAuthorization] = $authValue;

        return new Request($method, $url, $headers, $body);
    }

    private function signStringToSign(string $stringToSign, string $signingKey): string
    {
        $hm = hash_hmac('sha256', $stringToSign, $signingKey, true);
        return bin2hex($hm);
    }

    private function authHeaderValue(string $signature, string $accessKey, array $signedHeaders): string
    {
        $signedHeadersStr = implode(';', $signedHeaders);
        $headerValue = sprintf('%s Access=%s, SignedHeaders=%s, Signature=%s', Algorithm, $accessKey, $signedHeadersStr, $signature);
        $encodeVal = base64_encode($headerValue);

        return 'Bearer ' . $encodeVal;
    }

    private function canonicalRequest(string $method, string $url, array $headers, string $body, array $signedHeaders): string
    {
        $canonicalURI = parse_url($url, PHP_URL_PATH) . '/';
        $canonicalQueryString = parse_url($url, PHP_URL_QUERY) ?? '';
        $canonicalHeaders = $this->canonicalHeaders($headers, $signedHeaders);
        $signedHeadersStr = implode(';', $signedHeaders);
        $hexencode = hash('sha256', $body);

        return sprintf(
            "%s\n%s\n%s\n%s\n%s\n%s",
            $method,
            $canonicalURI,
            $canonicalQueryString,
            $canonicalHeaders,
            $signedHeadersStr,
            $hexencode
        );
    }

    private function canonicalHeaders(array $headers, array $signedHeaders): string
    {
        $lowheaders = array_change_key_case($headers, CASE_LOWER);
        $canonicalHeaders = [];

        foreach ($signedHeaders as $key) {
            $canonicalHeaders[] = $key . ':' . trim($lowheaders[$key]);
        }

        return implode("\n", $canonicalHeaders);
    }

    private function signedHeaders(array $headers): array
    {
        $signedHeaders = array_map('strtolower', array_keys($headers));
        sort($signedHeaders);
        return $signedHeaders;
    }

    private function stringToSign(string $canonicalRequest, string $timeFormat): string
    {
        $hash = hash('sha256', $canonicalRequest, true);
        return sprintf(
            "%s\n%s\n%s",
            Algorithm,
            $timeFormat,
            bin2hex($hash)
        );
    }
}
