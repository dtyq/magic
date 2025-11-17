<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\CloudswaySearch;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResponseDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResultItemDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\WebPagesDTO;
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
    ): SearchResponseDTO {
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

        // Convert Cloudsway response to unified format
        return $this->convertToUnifiedFormat($rawResponse);
    }

    public function convertToUnifiedFormat(array $cloudswayResponse): SearchResponseDTO
    {
        $response = new SearchResponseDTO();

        // Check if Cloudsway already returns Bing-compatible format
        if (isset($cloudswayResponse['webPages'])) {
            // Already in Bing format, convert to DTO
            $webPagesData = $cloudswayResponse['webPages'];
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
        } else {
            // Otherwise, convert (adjust based on actual Cloudsway response structure)
            $results = $cloudswayResponse['results'] ?? $cloudswayResponse['data'] ?? [];

            $webPages = new WebPagesDTO();
            $webPages->setTotalEstimatedMatches(
                $cloudswayResponse['totalEstimatedMatches']
                ?? $cloudswayResponse['total']
                ?? count($results)
            );

            $resultItems = [];
            foreach ($results as $index => $item) {
                $resultItem = new SearchResultItemDTO();
                $resultItem->setId($item['id'] ?? (string) $index);
                $resultItem->setName($item['name'] ?? $item['title'] ?? '');
                $resultItem->setUrl($item['url'] ?? '');
                $resultItem->setSnippet($item['snippet'] ?? $item['description'] ?? $item['content'] ?? '');
                $resultItem->setDisplayUrl($item['displayUrl'] ?? $this->extractDomain($item['url'] ?? ''));
                $resultItem->setDateLastCrawled($item['dateLastCrawled'] ?? '');
                $resultItems[] = $resultItem;
            }
            $webPages->setValue($resultItems);
            $response->setWebPages($webPages);
        }

        $response->setRawResponse($cloudswayResponse);
        return $response;
    }

    public function getEngineName(): string
    {
        return 'cloudsway';
    }

    public function isAvailable(): bool
    {
        return ! empty($this->config->get('search.drivers.cloudsway.endpoint'))
            && ! empty($this->config->get('search.drivers.cloudsway.access_key'));
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
