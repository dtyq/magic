<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\DTO\SearchResponseDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResultItemDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\WebPagesDTO;
use App\Infrastructure\ExternalAPI\Search\GoogleSearch;

/**
 * Google Custom Search API adapter.
 * Converts Google's response format to Bing-compatible format.
 */
class GoogleSearchAdapter implements SearchEngineAdapterInterface
{
    private array $providerConfig;

    public function __construct(
        private readonly GoogleSearch $googleSearch,
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
        // Get configuration from provider config
        $requestUrl = $this->providerConfig['request_url'] ?? '';
        $apiKey = $this->providerConfig['api_key'] ?? '';
        $cx = $this->providerConfig['cx'] ?? '';

        // Call GoogleSearch with all parameters
        $rawResponse = $this->googleSearch->search(
            $query,
            $apiKey,
            $requestUrl,
            $cx,
            $mkt,
            $count,
            $offset,
            $safeSearch,
            $freshness,
            $setLang
        );

        // Convert Google response to unified format
        return $this->convertToUnifiedFormat($rawResponse);
    }

    public function convertToUnifiedFormat(array $googleResponse): SearchResponseDTO
    {
        $response = new SearchResponseDTO();
        $response->setRawResponse($googleResponse);

        $items = $googleResponse['items'] ?? [];
        $totalResults = (int) ($googleResponse['searchInformation']['totalResults'] ?? 0);

        $webPages = new WebPagesDTO();
        $webPages->setTotalEstimatedMatches($totalResults);

        $resultItems = [];
        foreach ($items as $item) {
            $resultItem = new SearchResultItemDTO();
            $resultItem->setId($item['cacheId'] ?? uniqid('google_'));
            $resultItem->setName($item['title'] ?? '');
            $resultItem->setUrl($item['link'] ?? '');
            $resultItem->setSnippet($item['snippet'] ?? '');
            $resultItem->setDisplayUrl($item['displayLink'] ?? '');
            $resultItem->setDateLastCrawled(''); // Google doesn't provide this
            $resultItems[] = $resultItem;
        }
        $webPages->setValue($resultItems);
        $response->setWebPages($webPages);

        return $response;
    }

    public function getEngineName(): string
    {
        return 'google';
    }

    public function isAvailable(): bool
    {
        return ! empty($this->providerConfig['request_url'])
            && ! empty($this->providerConfig['api_key'])
            && ! empty($this->providerConfig['cx']);
    }
}
