<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\CloudswaySearch;
use Hyperf\Contract\ConfigInterface;

/**
 * Cloudsway Search API adapter.
 * Converts Cloudsway's response format to Bing-compatible format.
 */
class CloudswaySearchAdapter implements SearchEngineAdapterInterface
{
    public function __construct(
        private readonly CloudswaySearch $cloudswaySearch,
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
        // Call Cloudsway search
        // Note: CloudswaySearch doesn't use safeSearch parameter
        $rawResponse = $this->cloudswaySearch->search(
            $query,
            $mkt,
            $count,
            $offset,
            $freshness,
            $setLang
        );

        // Convert Cloudsway response to unified Bing-compatible format
        return $this->convertToUnifiedFormat($rawResponse);
    }

    public function getEngineName(): string
    {
        return 'cloudsway';
    }

    public function isAvailable(): bool
    {
        return ! empty($this->config->get('search.cloudsway.endpoint'))
            && ! empty($this->config->get('search.cloudsway.access_key'));
    }

    /**
     * Convert Cloudsway response to Bing-compatible format.
     * Assuming Cloudsway returns a structure similar to Bing or needs conversion.
     */
    private function convertToUnifiedFormat(array $cloudswayResponse): array
    {
        // Check if Cloudsway already returns Bing-compatible format
        if (isset($cloudswayResponse['webPages'])) {
            // Already in Bing format
            return $cloudswayResponse;
        }

        // Otherwise, convert (adjust based on actual Cloudsway response structure)
        $results = $cloudswayResponse['results'] ?? $cloudswayResponse['data'] ?? [];

        return [
            'webPages' => [
                'totalEstimatedMatches' => $cloudswayResponse['totalEstimatedMatches']
                    ?? $cloudswayResponse['total']
                    ?? count($results),
                'value' => array_map(function ($item, $index) {
                    return [
                        'id' => $item['id'] ?? (string) $index,
                        'name' => $item['name'] ?? $item['title'] ?? '',
                        'url' => $item['url'] ?? '',
                        'snippet' => $item['snippet'] ?? $item['description'] ?? $item['content'] ?? '',
                        'displayUrl' => $item['displayUrl'] ?? $this->extractDomain($item['url'] ?? ''),
                        'dateLastCrawled' => $item['dateLastCrawled'] ?? '',
                    ];
                }, $results, array_keys($results)),
            ],
            '_rawResponse' => $cloudswayResponse,
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
