<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\BadResponseException;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\StdoutLoggerInterface;
use RuntimeException;
use Throwable;

class GoogleSearch
{
    private const string GOOGLE_SEARCH_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

    private const int DEFAULT_SEARCH_ENGINE_TIMEOUT = 5;

    private const int REFERENCE_COUNT = 8; // 替换为你需要的引用数量

    public function __construct(protected readonly StdoutLoggerInterface $logger, protected readonly ConfigInterface $config)
    {
    }

    /**
     * Execute Google Custom Search with comprehensive parameters.
     *
     * @param string $query Search query
     * @param string $subscriptionKey Google API key
     * @param string $cx Custom Search Engine ID
     * @param string $mkt Market code (e.g., zh-CN, en-US) - mapped to lr and gl parameters
     * @param int $count Number of results (1-10, Google API limitation)
     * @param int $offset Pagination offset (start parameter)
     * @param string $safeSearch Safe search level (off, medium, high)
     * @param string $freshness Time filter - not directly supported by Google, reserved for future use
     * @param string $setLang UI language code - mapped to hl parameter
     * @return array Google API response
     */
    public function search(
        string $query,
        string $subscriptionKey,
        string $cx,
        string $mkt = '',
        int $count = self::REFERENCE_COUNT,
        int $offset = 0,
        string $safeSearch = '',
        string $freshness = '',
        string $setLang = ''
    ): array {
        $client = new Client();

        $params = [
            'key' => $subscriptionKey,
            'cx' => $cx,
            'q' => $query,
            'num' => $count,
        ];

        // Add pagination offset
        if ($offset > 0) {
            $params['start'] = $offset + 1; // Google uses 1-based indexing
        }

        // Add market/locale parameters
        if (! empty($mkt)) {
            // Map mkt to Google's lr (language restrict) and gl (country) parameters
            $parts = explode('-', $mkt);
            if (count($parts) === 2) {
                $params['lr'] = 'lang_' . strtolower($parts[0]); // e.g., lang_zh
                $params['gl'] = strtolower($parts[1]); // e.g., cn
            }
        }

        // Add safe search
        if (! empty($safeSearch)) {
            // Map Bing-style values to Google values
            $safeSearchMap = [
                'Strict' => 'high',
                'Moderate' => 'medium',
                'Off' => 'off',
            ];
            $params['safe'] = $safeSearchMap[$safeSearch] ?? strtolower($safeSearch);
        }

        // Add UI language
        if (! empty($setLang)) {
            $params['hl'] = $setLang;
        }

        // Note: freshness is not directly supported by Google Custom Search API
        // but we keep the parameter for interface consistency

        try {
            $options = [
                'query' => $params,
                'timeout' => self::DEFAULT_SEARCH_ENGINE_TIMEOUT,
            ];
            $proxy = $this->config->get('odin.http.proxy');
            if (! empty($proxy)) {
                $options['proxy'] = $proxy;
            }
            $response = $client->get(
                self::GOOGLE_SEARCH_ENDPOINT,
                $options
            );
            if ($response->getStatusCode() !== 200) {
                throw new RuntimeException('Search engine error: ' . $response->getBody());
            }

            return Json::decode($response->getBody()->getContents());
        } catch (BadResponseException|RequestException $e) {
            // 记录错误日志
            $this->logger->error(sprintf(
                '谷歌搜索遇到错误:%s,file:%s,line:%s trace:%s, will generate again.',
                $e->getResponse()?->getBody(), /* @phpstan-ignore-line */
                $e->getFile(),
                $e->getLine(),
                $e->getTraceAsString()
            ));
            return [];
        } catch (Throwable$e) {
            $this->logger->error('谷歌搜索遇到错误:' . $e->getMessage());
        }
        return [];
    }
}
