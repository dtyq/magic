<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\BingSearch;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResponseDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResultItemDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\WebPagesDTO;
use Hyperf\Contract\ConfigInterface;

/**
 * Bing search engine adapter.
 * Bing's response format is already our unified standard format.
 */
class BingSearchAdapter implements SearchEngineAdapterInterface
{
    public function __construct(
        private readonly BingSearch $bingSearch,
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
        $apiKey = $this->config->get('search.drivers.bing.api_key');

        // Call original BingSearch with all parameters
        $rawResponse = $this->bingSearch->search(
            $query,
            $apiKey,
            $mkt,
            $count,
            $offset,
            $safeSearch,
            $freshness,
            $setLang
        );

        // Bing already returns the standard format, convert to DTO
        return $this->convertToUnifiedFormat($rawResponse);
    }

    public function convertToUnifiedFormat(array $rawResponse): SearchResponseDTO
    {
        $response = new SearchResponseDTO();

        // Bing already returns in standard format
        if (isset($rawResponse['webPages'])) {
            $webPagesData = $rawResponse['webPages'];
            $webPages = new WebPagesDTO();
            $webPages->setTotalEstimatedMatches($webPagesData['totalEstimatedMatches'] ?? 0);

            $items = [];
            foreach ($webPagesData['value'] ?? [] as $item) {
                $resultItem = new SearchResultItemDTO();
                $resultItem->setId($item['id'] ?? '');
                $resultItem->setName($item['name'] ?? '');
                $resultItem->setUrl($item['url'] ?? '');
                $resultItem->setSnippet($item['snippet'] ?? '');
                $resultItem->setDisplayUrl($item['displayUrl'] ?? '');
                $resultItem->setDateLastCrawled($item['dateLastCrawled'] ?? '');
                $items[] = $resultItem;
            }
            $webPages->setValue($items);
            $response->setWebPages($webPages);
        }

        return $response;
    }

    public function getEngineName(): string
    {
        return 'bing';
    }

    public function isAvailable(): bool
    {
        return ! empty($this->config->get('search.drivers.bing.api_key'));
    }
}

