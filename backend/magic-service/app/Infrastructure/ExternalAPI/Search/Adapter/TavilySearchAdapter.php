<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\TavilySearch;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResponseDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResultItemDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\WebPagesDTO;
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
    ): SearchResponseDTO {
        // Tavily does not support offset pagination
        // If offset > 0, return empty results with warning
        if ($offset > 0) {
            $response = new SearchResponseDTO();
            $response->setWarning('Tavily search does not support pagination (offset parameter is ignored)');
            $webPages = new WebPagesDTO();
            $webPages->setTotalEstimatedMatches(0);
            $webPages->setValue([]);
            $response->setWebPages($webPages);
            return $response;
        }

        // Tavily uses maxResults parameter for count
        // Cap count at reasonable limit (Tavily supports up to ~10 results typically)
        $maxResults = min($count, 10);

        // Call Tavily search
        $rawResponse = $this->tavilySearch->results($query, $maxResults);

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
        return ! empty($this->config->get('search.drivers.tavily.api_key'));
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
