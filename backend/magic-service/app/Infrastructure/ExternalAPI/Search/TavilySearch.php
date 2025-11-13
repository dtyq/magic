<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search;

use GuzzleHttp\Client;
use Hyperf\Contract\ConfigInterface;
use RuntimeException;

class TavilySearch
{
    protected const API_URL = 'https://api.tavily.com';

    protected Client $client;

    protected array $apiKeys;

    public function __construct(Client $client, ConfigInterface $config)
    {
        $this->client = $client;
        $apiKey = $config->get('search.tavily.api_key');
        $this->apiKeys = explode(',', $apiKey);
    }

    /**
     * Execute Tavily search with unified parameters.
     *
     * @param string $query Search query
     * @param string $mkt Market code (not directly supported by Tavily)
     * @param int $count Number of results (maxResults, typically capped at 10)
     * @param int $offset Pagination offset (not supported by Tavily)
     * @param string $safeSearch Safe search level (not directly supported by Tavily)
     * @param string $freshness Time filter (not directly supported by Tavily)
     * @param string $setLang UI language code (not directly supported by Tavily)
     * @return array Search results
     */
    public function search(
        string $query,
        string $mkt = '',
        int $count = 5,
        int $offset = 0,
        string $safeSearch = '',
        string $freshness = '',
        string $setLang = ''
    ): array {
        // Tavily does not support offset pagination
        // Return empty results if offset is requested
        if ($offset > 0) {
            return [];
        }

        // Cap count at 10 (Tavily typical limit)
        $maxResults = min($count, 10);

        // Call the existing results() method
        return $this->results($query, $maxResults);
    }

    public function results(
        string $query,
        int $maxResults = 5,
        string $searchDepth = 'basic',
        $includeAnswer = false
    ): array {
        return $this->rawResults($query, $maxResults, $searchDepth, includeAnswer: $includeAnswer);
    }

    protected function rawResults(
        string $query,
        int $maxResults = 5,
        string $searchDepth = 'basic',
        array $includeDomains = [],
        array $excludeDomains = [],
        bool $includeAnswer = false,
        bool $includeRawContent = false,
        bool $includeImages = false
    ): array {
        // 如果 $query 的长度小于 5，用省略号填充到 5
        if (mb_strlen($query) < 5) {
            $query = mb_str_pad($query, 6, '.');
        }
        $uri = self::API_URL . '/search';
        $randApiKey = $this->apiKeys[array_rand($this->apiKeys)];
        $response = $this->client->post($uri, [
            'json' => [
                'api_key' => $randApiKey,
                'query' => $query,
                'max_results' => $maxResults,
                'search_depth' => $searchDepth,
                'include_domains' => $includeDomains,
                'exclude_domains' => $excludeDomains,
                'include_answer' => $includeAnswer,
                'include_raw_content' => $includeRawContent,
                'include_images' => $includeImages,
            ],
            'verify' => false,
        ]);
        if ($response->getStatusCode() !== 200) {
            throw new RuntimeException('Failed to fetch results from Tavily Search API with status code ' . $response->getStatusCode());
        }
        return json_decode($response->getBody()->getContents(), true);
    }
}
