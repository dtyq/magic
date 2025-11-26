<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\DTO\SearchResponseDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResultItemDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\WebPagesDTO;
use App\Infrastructure\ExternalAPI\Search\TavilySearch;

/**
 * Tavily Search API adapter.
 * Converts Tavily's response format to Bing-compatible format.
 */
class TavilySearchAdapter implements SearchEngineAdapterInterface
{
    private array $providerConfig;

    public function __construct(
        private readonly TavilySearch $tavilySearch,
        array $providerConfig = []
    ) {
        $this->providerConfig = $providerConfig;
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
        $page = $offset + 1; // Tavily uses 1-based page index
        $requestUrl = $this->providerConfig['request_url'] ?? '';
        $apiKey = $this->providerConfig['api_key'] ?? '';
        // Call Tavily search
        $rawResponse = $this->tavilySearch->search($query, page: $page, count: $count, requestUrl: $requestUrl, apiKey: $apiKey);

        // Convert Tavily response to unified format
        return $this->convertToUnifiedFormat($rawResponse);
    }

    public function convertToUnifiedFormat(array $tavilyResponse): SearchResponseDTO
    {
        $response = new SearchResponseDTO();
        $response->setRawResponse($tavilyResponse);

        $results = $tavilyResponse['results'] ?? [];

        $webPages = new WebPagesDTO();
        $webPages->setTotalEstimatedMatches(count($results));

        $resultItems = [];
        foreach ($results as $index => $item) {
            $resultItem = new SearchResultItemDTO();
            $resultItem->setId((string) $index);
            $resultItem->setName($item['title'] ?? '');
            $resultItem->setUrl($item['url'] ?? '');
            $resultItem->setSnippet($item['content'] ?? '');
            $resultItem->setDisplayUrl($this->extractDomain($item['url'] ?? ''));
            $resultItem->setDateLastCrawled(''); // Tavily doesn't provide this
            $resultItem->setScore($item['score'] ?? null); // Tavily-specific relevance score
            $resultItems[] = $resultItem;
        }
        $webPages->setValue($resultItems);
        $response->setWebPages($webPages);

        return $response;
    }

    public function getEngineName(): string
    {
        return 'tavily';
    }

    public function isAvailable(): bool
    {
        return ! empty($this->providerConfig['request_url'])
            && ! empty($this->providerConfig['api_key']);
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
