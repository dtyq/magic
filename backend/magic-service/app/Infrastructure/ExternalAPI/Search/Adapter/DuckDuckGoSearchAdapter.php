<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\DuckDuckGoSearch;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResponseDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResultItemDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\WebPagesDTO;
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
    ): SearchResponseDTO {
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

        // Convert DuckDuckGo response to unified format
        return $this->convertToUnifiedFormat($rawResponse);
    }

    public function convertToUnifiedFormat(array $duckduckgoResponse): SearchResponseDTO
    {
        $response = new SearchResponseDTO();
        $response->setRawResponse($duckduckgoResponse);

        $webPages = new WebPagesDTO();
        $webPages->setTotalEstimatedMatches(count($duckduckgoResponse));

        $resultItems = [];
        foreach ($duckduckgoResponse as $index => $item) {
            $resultItem = new SearchResultItemDTO();
            $resultItem->setId((string) $index);
            $resultItem->setName($item['title'] ?? '');
            $resultItem->setUrl($item['url'] ?? '');
            $resultItem->setSnippet($item['body'] ?? '');
            $resultItem->setDisplayUrl($this->extractDomain($item['url'] ?? ''));
            $resultItem->setDateLastCrawled(''); // DuckDuckGo doesn't provide this
            $resultItems[] = $resultItem;
        }
        $webPages->setValue($resultItems);
        $response->setWebPages($webPages);

        return $response;
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
     * Map market code (mkt) to DuckDuckGo region code.
     *
     * DuckDuckGo uses reversed format: language-COUNTRY → country-language
     * Examples: zh-CN -> cn-zh, en-US -> us-en
     */
    private function mapMktToRegion(string $mkt): string
    {
        if (empty($mkt)) {
            return $this->config->get('search.drivers.duckduckgo.region', 'wt-wt'); // worldwide
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
