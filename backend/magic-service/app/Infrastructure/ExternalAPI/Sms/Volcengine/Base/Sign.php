<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Sms\Volcengine\Base;

/**
 * 火山api签名类.
 */
class Sign
{
    public const string ISO8601_BASIC = 'Ymd\THis\Z';

    private array $cache = [];

    private int $cacheSize = 0;

    public function signOnly(SignParam $param, $credentials): SignResult
    {
        $ldt = gmdate(self::ISO8601_BASIC, $param->getDate()->getTimestamp());
        $sdt = substr($ldt, 0, 8);
        $cs = $this->createScope($sdt, $credentials['region'], $credentials['service']);
        $credential = $credentials['ak'] . '/' . $cs;
        $parsed['method'] = $param->getMethod();
        $parsed['path'] = $param->getPath();
        $parsed['query'] = $param->getQueryList();
        $parsed['headers'] = $param->getHeaderList();
        $parsed['headers']['X-Date'] = [$ldt];

        $isSignUrl = $param->isSignUrl();
        if ($isSignUrl) {
            $parsed['query']['X-NotSignBody'] = '';
            $parsed['query']['X-Algorithm'] = 'HMAC-SHA256';
            $parsed['query']['X-Credential'] = $credential;
            $parsed['query']['X-SignedHeaders'] = '';
            $signedQueries = array_keys($parsed['query']);
            sort($signedQueries);
            $parsed['query']['X-SignedQueries'] = implode(';', $signedQueries);
        }
        $context = $this->createContext($parsed, $param->getPayloadHash());
        $toSign = $this->createStringToSign($ldt, $cs, $context['creq']);
        $signingKey = $this->getSigningKey(
            $sdt,
            $credentials['region'],
            $credentials['service'],
            $credentials['sk']
        );
        $signature = hash_hmac('sha256', $toSign, $signingKey);
        $result = new SignResult();
        $result->setXAlgorithm('HMAC-SHA256');
        $result->setXCredential($credential);
        $result->setXDate($ldt);
        $result->setXSignature($signature);
        if (isset($context['headers'])) {
            $result->setXSignedHeaders($context['headers']);
        }
        if (isset($parsed['query']['X-SignedQueries'])) {
            $result->setXSignedQueries($parsed['query']['X-SignedQueries']);
        }
        $result->setAuthorization(sprintf('HMAC-SHA256 Credential=%s, SignedHeaders=%s, Signature=%s', $credential, $context['headers'], $signature));
        return $result;
    }

    protected function createCanonicalizedPath($path): string
    {
        $doubleEncoded = rawurlencode(ltrim($path, '/'));

        return '/' . str_replace('%2F', '/', $doubleEncoded);
    }

    private function createScope($shortDate, $region, $service): string
    {
        return sprintf('%s/%s/%s/request', $shortDate, $region, $service);
    }

    private function getSigningKey(string $shortDate, string $region, string $service, string $secretKey)
    {
        $k = $shortDate . '_' . $region . '_' . $service . '_' . $secretKey;

        if (! isset($this->cache[$k])) {
            // Clear the cache when it reaches 50 entries
            if (++$this->cacheSize > 50) {
                $this->cache = [];
                $this->cacheSize = 0;
            }

            $dateKey = hash_hmac(
                'sha256',
                $shortDate,
                $secretKey,
                true
            );
            $regionKey = hash_hmac('sha256', $region, $dateKey, true);
            $serviceKey = hash_hmac('sha256', $service, $regionKey, true);
            $this->cache[$k] = hash_hmac(
                'sha256',
                'request',
                $serviceKey,
                true
            );
        }

        return $this->cache[$k];
    }

    private function createContext(array $parsedRequest, $payload): array
    {
        static $blacklist = [
            'cache-control' => true,
            'content-type' => true,
            'content-length' => true,
            'expect' => true,
            'max-forwards' => true,
            'pragma' => true,
            'range' => true,
            'te' => true,
            'if-match' => true,
            'if-none-match' => true,
            'if-modified-since' => true,
            'if-unmodified-since' => true,
            'if-range' => true,
            'accept' => true,
            'authorization' => true,
            'proxy-authorization' => true,
            'from' => true,
            'referer' => true,
            'user-agent' => true,
        ];

        $canon = $parsedRequest['method'] . "\n"
            . $this->createCanonicalizedPath($parsedRequest['path']) . "\n"
            . $this->getCanonicalizedQuery($parsedRequest['query']) . "\n";

        $signedHeadersString = '';
        $canonHeaders = [];
        // Case-insensitively aggregate all the headers.
        if (! isset($parsedRequest['query']['X-SignedQueries'])) {
            $aggregate = [];
            foreach ($parsedRequest['headers'] as $key => $values) {
                $key = strtolower($key);
                if (! isset($blacklist[$key]) && is_array($values)) {
                    foreach ($values as $v) {
                        $aggregate[$key][] = $v;
                    }
                }
                if (! isset($blacklist[$key]) && is_string($values)) {
                    $aggregate[$key][] = $values;
                }
            }

            ksort($aggregate);
            foreach ($aggregate as $k => $v) {
                /* @phpstan-ignore-next-line */
                if (count($v) > 0) {
                    sort($v);
                }
                $canonHeaders[] = $k . ':' . preg_replace('/\s+/', ' ', implode(',', $v));
            }

            $signedHeadersString = implode(';', array_keys($aggregate));
        }
        $canon .= implode("\n", $canonHeaders) . "\n\n"
            . $signedHeadersString . "\n"
            . $payload;

        return ['creq' => $canon, 'headers' => $signedHeadersString];
    }

    private function createStringToSign(string $longDate, string $credentialScope, string $creq): string
    {
        $hash = hash('sha256', $creq);

        return sprintf('HMAC-SHA256%s%s%s%s%s%s', PHP_EOL, $longDate, PHP_EOL, $credentialScope, PHP_EOL, $hash);
    }

    private function getCanonicalizedQuery(array $query): string
    {
        unset($query['X-Signature']);

        if (! $query) {
            return '';
        }

        $qs = '';
        if (isset($query['X-SignedQueries'])) {
            foreach (explode(';', $query['X-SignedQueries']) as $k) {
                $v = $query[$k];
                if (! is_array($v)) {
                    $qs .= rawurlencode($k) . '=' . rawurlencode($v) . '&';
                } else {
                    sort($v);
                    foreach ($v as $value) {
                        $qs .= rawurlencode($k) . '=' . rawurlencode($value) . '&';
                    }
                }
            }
        } else {
            ksort($query);
            foreach ($query as $k => $v) {
                if (! is_array($v)) {
                    $qs .= rawurlencode($k) . '=' . rawurlencode($v) . '&';
                } else {
                    sort($v);
                    foreach ($v as $value) {
                        $qs .= rawurlencode($k) . '=' . rawurlencode($value) . '&';
                    }
                }
            }
        }

        return substr($qs, 0, -1);
    }
}
