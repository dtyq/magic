<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\DTO\SearchResponseDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResultItemDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\WebPagesDTO;
use App\Infrastructure\ExternalAPI\Search\JinaSearch;

/**
 * Jina Search API adapter.
 * Converts Jina's response format to Bing-compatible format.
 */
class JinaSearchAdapter implements SearchEngineAdapterInterface
{
    private array $providerConfig;

    public function __construct(
        private readonly JinaSearch $jinaSearch,
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
        $requestUrl = $this->providerConfig['request_url'] ?? '';
        $apiKey = $this->providerConfig['api_key'] ?? '';

        // Call Jina search with all parameters
        // The service now handles parameter mapping internally
        $rawResponse = $this->jinaSearch->search(
            $query,
            $apiKey,
            $mkt,
            $count,
            $offset,
            $safeSearch,
            $freshness,
            $setLang,
            requestUrl: $requestUrl
        );

        // Convert Jina response to unified format
        return $this->convertToUnifiedFormat($rawResponse);
    }

    public function convertToUnifiedFormat(array $jinaResponse): SearchResponseDTO
    {
        $response = new SearchResponseDTO();
        $response->setRawResponse($jinaResponse);

        $webPages = new WebPagesDTO();
        $webPages->setTotalEstimatedMatches(count($jinaResponse));

        $resultItems = [];
        foreach ($jinaResponse as $index => $item) {
            $resultItem = new SearchResultItemDTO();
            $resultItem->setId((string) $index);
            $resultItem->setName($item['title'] ?? '');
            $resultItem->setUrl($item['url'] ?? '');
            $resultItem->setSnippet($item['content'] ?? $item['description'] ?? '');
            $resultItem->setDisplayUrl($this->extractDomain($item['url'] ?? ''));
            $resultItem->setDateLastCrawled(''); // Jina doesn't provide this
            $resultItems[] = $resultItem;
        }
        $webPages->setValue($resultItems);
        $response->setWebPages($webPages);

        return $response;
    }

    public function getEngineName(): string
    {
        return 'jina';
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
