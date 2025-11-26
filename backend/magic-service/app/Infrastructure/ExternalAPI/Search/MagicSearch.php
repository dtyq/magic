<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * Magic search engine - calls internal /v2/search API.
 */
class MagicSearch
{
    private const int DEFAULT_SEARCH_ENGINE_TIMEOUT = 30;

    private LoggerInterface $logger;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * Execute Magic search by calling internal unified search API.
     *
     * @param string $query Search query
     * @param string $baseUrl Magic service base URL (from config)
     * @param string $apiKey API key for authorization (from config)
     * @param string $mkt Market code (e.g., zh-CN, en-US)
     * @param int $count Number of results (1-50)
     * @param int $offset Pagination offset (0-1000)
     * @param string $safeSearch Safe search level (Strict, Moderate, Off)
     * @param string $freshness Time filter (Day, Week, Month)
     * @param string $setLang UI language code
     * @return array Unified search response
     * @throws GuzzleException
     */
    public function search(
        string $query,
        string $baseUrl,
        string $apiKey,
        string $mkt,
        int $count = 20,
        int $offset = 0,
        string $safeSearch = '',
        string $freshness = '',
        string $setLang = ''
    ): array {
        // Remove trailing slash from base URL
        $baseUrl = rtrim($baseUrl, '/');

        // Build query parameters
        $queryParams = [
            'query' => $query,
            'mkt' => $mkt,
            'count' => $count,
            'offset' => $offset,
        ];

        // Add optional parameters
        if (! empty($safeSearch)) {
            $queryParams['safe_search'] = $safeSearch;
        }

        if (! empty($freshness)) {
            $queryParams['freshness'] = $freshness;
        }

        if (! empty($setLang)) {
            $queryParams['set_lang'] = $setLang;
        }

        // Create Guzzle client
        $client = new Client([
            'base_uri' => $baseUrl,
            'timeout' => self::DEFAULT_SEARCH_ENGINE_TIMEOUT,
            'headers' => [
                'Authorization' => 'Bearer ' . $apiKey,
                'Accept' => 'application/json',
            ],
        ]);

        try {
            // Call internal /v2/search endpoint
            $response = $client->request('GET', '/v2/search', [
                'query' => $queryParams,
            ]);

            // Get response body
            $body = $response->getBody()->getContents();

            // Decode JSON response
            $data = Json::decode($body);
        } catch (RequestException $e) {
            // Handle HTTP errors
            if ($e->hasResponse()) {
                $statusCode = $e->getResponse()?->getStatusCode();
                $reason = $e->getResponse()?->getReasonPhrase();
                $responseBody = $e->getResponse()?->getBody()->getContents();
                $this->logger->error(sprintf('Magic Search HTTP %d %s: %s', $statusCode, $reason, $responseBody), [
                    'base_url' => $baseUrl,
                    'status_code' => $statusCode,
                ]);
            } else {
                // Network error
                $this->logger->error($e->getMessage(), [
                    'base_url' => $baseUrl,
                    'exception' => get_class($e),
                ]);
            }

            throw new RuntimeException('Magic search engine error: ' . $e->getMessage());
        }

        return $data;
    }
}
