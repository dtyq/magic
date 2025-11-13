<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\DuckDuckGoSearch;
use Hyperf\Contract\ConfigInterface;

/**
 * DuckDuckGo search adapter.
 * Converts DuckDuckGo's response format to Bing-compatible format.
 */
class DuckDuckGoSearchAdapter implements SearchEngineAdapterInterface
{
    public function __construct(
        private readonly DuckDuckGoSearch $duckDuckGoSearch,
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
        // Map market code to DuckDuckGo region (e.g., zh-CN -> cn-zh)
        $region = $this->mapMktToRegion($mkt);

        // Map freshness to DuckDuckGo time parameter
        $time = $this->mapFreshnessToTime($freshness);

        // Note: DuckDuckGo doesn't support offset pagination natively
        // and doesn't provide count control in the lite API
        $rawResponse = $this->duckDuckGoSearch->search($query, $region, $time);

        // Convert DuckDuckGo response to unified Bing-compatible format
        return $this->convertToUnifiedFormat($rawResponse, $count, $offset);
    }

    public function getEngineName(): string
    {
        return 'duckduckgo';
    }

    public function isAvailable(): bool
    {
        // DuckDuckGo doesn't require API key, always available
        return true;
    }

    /**
     * Convert DuckDuckGo response to Bing-compatible format.
     */
    private function convertToUnifiedFormat(array $duckduckgoResponse, int $count, int $offset): array
    {
        // Apply offset and count manually since DDG doesn't support them
        $slicedResults = array_slice($duckduckgoResponse, $offset, $count);

        return [
            'webPages' => [
                'totalEstimatedMatches' => count($duckduckgoResponse),
                'value' => array_map(function ($item, $index) {
                    return [
                        'id' => (string) $index,
                        'name' => $item['title'] ?? '',
                        'url' => $item['url'] ?? '',
                        'snippet' => $item['body'] ?? '',
                        'displayUrl' => $this->extractDomain($item['url'] ?? ''),
                        'dateLastCrawled' => '', // DuckDuckGo doesn't provide this
                    ];
                }, $slicedResults, array_keys($slicedResults)),
            ],
            '_rawResponse' => $duckduckgoResponse,
        ];
    }

    /**
     * Map market code (mkt) to DuckDuckGo region code.
     * Examples: zh-CN -> cn-zh, en-US -> us-en.
     */
    private function mapMktToRegion(string $mkt): string
    {
        if (empty($mkt)) {
            return $this->config->get('search.duckduckgo.region', 'wt-wt'); // worldwide
        }

        // Simple mapping: zh-CN -> cn-zh
        $parts = explode('-', $mkt);
        if (count($parts) === 2) {
            return strtolower($parts[1]) . '-' . strtolower($parts[0]);
        }

        return $mkt;
    }

    /**
     * Map freshness to DuckDuckGo time parameter.
     * Freshness: Day/Week/Month -> Time: d/w/m.
     */
    private function mapFreshnessToTime(string $freshness): ?string
    {
        return match (strtolower($freshness)) {
            'day' => 'd',
            'week' => 'w',
            'month' => 'm',
            default => null,
        };
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
