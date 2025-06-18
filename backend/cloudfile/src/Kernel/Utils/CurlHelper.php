<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Kernel\Utils;

use Dtyq\CloudFile\Kernel\Exceptions\CloudFileException;

class CurlHelper
{
    /**
     * 由于 Guzzle MultipartStream 一定会带上 content-length，只能使用 curl.
     * @return array{'headers': array<string, string>, 'body': string}
     */
    public static function sendRequest(string $url, mixed $data, array $headers = [], int $successCode = 200): array
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_POST, 1);
        if (! empty($data)) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        }
        if (! empty($headers)) {
            $inputHeaders = [];
            foreach ($headers as $key => $value) {
                $inputHeaders[] = $key . ': ' . $value;
            }
            curl_setopt($ch, CURLOPT_HTTPHEADER, $inputHeaders);
        }

        try {
            $output = curl_exec($ch);
            if ($output === false) {
                throw new CloudFileException('curl error: ' . curl_error($ch));
            }
            $httpStatusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            if ($httpStatusCode !== $successCode) {
                throw new CloudFileException('curl error: ' . $output);
            }

            // Separate headers and body
            $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            $header = substr($output, 0, $headerSize);
            $body = substr($output, $headerSize);

            // Parse headers into an associative array
            $headerLines = explode("\r\n", trim($header));
            $responseHeaders = [];
            foreach ($headerLines as $line) {
                if (str_contains($line, ': ')) {
                    [$key, $value] = explode(': ', $line, 2);
                    $responseHeaders[$key] = trim($value, '"');
                }
            }

            return ['headers' => $responseHeaders, 'body' => $body];
        } finally {
            curl_close($ch);
        }
    }
}
