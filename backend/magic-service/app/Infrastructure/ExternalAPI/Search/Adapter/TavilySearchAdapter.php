<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\TavilySearch;
use Hyperf\Contract\ConfigInterface;

/**
 * Tavily Search API adapter.
 * Converts Tavily's response format to Bing-compatible format.
 */
class TavilySearchAdapter implements SearchEngineAdapterInterface
{
    public function __construct(
        private readonly TavilySearch $tavilySearch,
        private readonly ConfigInterface $config
    ) {
    }

    public function search(
        string $query,
        string $mkt,
        int $count = 20,
        int $offset = 0,
        string $safeSearch = '',
        string $freshness = '',
        string $setLang = ''
    ): array {
        // Tavily does not support offset pagination
        // If offset > 0, return empty results with warning
        if ($offset > 0) {
            return [
                'webPages' => [
                    'totalEstimatedMatches' => 0,
                    'value' => [],
                ],
                '_warning' => 'Tavily search does not support pagination (offset parameter is ignored)',
            ];
        }

        // Tavily uses maxResults parameter for count
        // Cap count at reasonable limit (Tavily supports up to ~10 results typically)
        $maxResults = min($count, 10);

        // Call Tavily search
        $rawResponse = $this->tavilySearch->results($query, $maxResults);

        // Convert Tavily response to unified Bing-compatible format
        return $this->convertToUnifiedFormat($rawResponse);
    }

    public function getEngineName(): string
    {
        return 'tavily';
    }

    public function isAvailable(): bool
    {
        return ! empty($this->config->get('search.tavily.api_key'));
    }

    /**
     * Convert Tavily response to Bing-compatible format.
     */
    private function convertToUnifiedFormat(array $tavilyResponse): array
    {
        $results = $tavilyResponse['results'] ?? [];

        return [
            'webPages' => [
                'totalEstimatedMatches' => count($results),
                'value' => array_map(function ($item, $index) {
                    return [
                        'id' => (string) $index,
                        'name' => $item['title'] ?? '',
                        'url' => $item['url'] ?? '',
                        'snippet' => $item['content'] ?? '',
                        'displayUrl' => $this->extractDomain($item['url'] ?? ''),
                        'dateLastCrawled' => '', // Tavily doesn't provide this
                        'score' => $item['score'] ?? 0, // Tavily-specific relevance score
                    ];
                }, $results, array_keys($results)),
            ],
            '_rawResponse' => $tavilyResponse,
        ];
    }

    /**
     * Extract domain from URL for display.
     */
    private function extractDomain(string $url): string
    {
        $host = parse_url($url, PHP_URL_HOST);
        return $host ?: '';
    }
}
