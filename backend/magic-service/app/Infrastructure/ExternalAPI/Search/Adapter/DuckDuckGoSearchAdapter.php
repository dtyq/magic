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
        // Adapter's job: Map unified parameters to DuckDuckGo-specific format

        // Map market code to DuckDuckGo region (e.g., zh-CN -> cn-zh)
        $region = $this->mapMktToRegion($mkt);

        // Map freshness to DuckDuckGo time parameter (Day -> d, Week -> w, Month -> m)
        $time = $this->mapFreshnessToTime($freshness);

        // Call DuckDuckGo API with its native parameters
        // Note: DuckDuckGo Lite API doesn't support native pagination
        // count and offset will be applied via array slicing in the service
        $rawResponse = $this->duckDuckGoSearch->search(
            $query,
            $mkt,
            $count,
            $offset,
            $safeSearch,
            $freshness,
            $setLang,
            $region,  // Pass mapped region
            $time     // Pass mapped time
        );

        // Convert DuckDuckGo response to unified Bing-compatible format
        return $this->convertToUnifiedFormat($rawResponse);
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
    private function convertToUnifiedFormat(array $duckduckgoResponse): array
    {
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
                }, $duckduckgoResponse, array_keys($duckduckgoResponse)),
            ],
            '_rawResponse' => $duckduckgoResponse,
        ];
    }

    /**
     * Map market code (mkt) to DuckDuckGo region code.
     *
     * DuckDuckGo uses reversed format: language-COUNTRY → country-language
     * Examples: zh-CN -> cn-zh, en-US -> us-en
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
     * Map freshness (Bing-style) to DuckDuckGo time parameter.
     *
     * Bing uses full words, DuckDuckGo uses single letters
     * Freshness: Day/Week/Month -> Time: d/w/m
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
