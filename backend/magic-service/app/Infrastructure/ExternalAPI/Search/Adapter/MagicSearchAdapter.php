<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\DTO\SearchResponseDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResultItemDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\WebPagesDTO;
use App\Infrastructure\ExternalAPI\Search\MagicSearch;

/**
 * Magic Search API adapter.
 * Calls internal Magic search API which proxies to other search engines.
 */
class MagicSearchAdapter implements SearchEngineAdapterInterface
{
    private array $providerConfig;

    public function __construct(
        private readonly MagicSearch $magicSearch,
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
        $baseUrl = $this->providerConfig['base_url'] ?? '';
        $apiKey = $this->providerConfig['api_key'] ?? '';

        // Call Magic search API
        $rawResponse = $this->magicSearch->search(
            $query,
            $baseUrl,
            $apiKey,
            $mkt,
            $count,
            $offset,
            $safeSearch,
            $freshness,
            $setLang
        );

        // Convert response to unified format
        return $this->convertToUnifiedFormat($rawResponse);
    }

    public function convertToUnifiedFormat(array $magicResponse): SearchResponseDTO
    {
        $response = new SearchResponseDTO();

        // Magic API returns data in snake_case format, need to convert
        if (isset($magicResponse['web_pages'])) {
            $webPagesData = $magicResponse['web_pages'];
            $webPages = new WebPagesDTO();
            $webPages->setTotalEstimatedMatches($webPagesData['total_estimated_matches'] ?? 0);

            $resultItems = [];
            foreach ($webPagesData['value'] ?? [] as $item) {
                $resultItem = new SearchResultItemDTO();
                $resultItem->setId($item['id'] ?? '');
                $resultItem->setName($item['name'] ?? '');
                $resultItem->setUrl($item['url'] ?? '');
                $resultItem->setSnippet($item['snippet'] ?? '');
                $resultItem->setDisplayUrl($item['display_url'] ?? '');
                $resultItem->setDateLastCrawled($item['dateLast_crawled'] ?? '');
                if (isset($item['score'])) {
                    $resultItem->setScore($item['score']);
                }
                $resultItems[] = $resultItem;
            }
            $webPages->setValue($resultItems);
            $response->setWebPages($webPages);
        }

        // Set raw response and metadata
        if (isset($magicResponse['raw_response'])) {
            $response->setRawResponse($magicResponse['raw_response']);
        }

        if (isset($magicResponse['warning'])) {
            $response->setWarning($magicResponse['warning']);
        }

        if (isset($magicResponse['metadata'])) {
            $response->setMetadata($magicResponse['metadata']);
        }

        return $response;
    }

    public function getEngineName(): string
    {
        return 'magic';
    }

    public function isAvailable(): bool
    {
        // Check if base_url and api_key are configured
        return ! empty($this->providerConfig['request_url'])
            && ! empty($this->providerConfig['api_key']);
    }
}
