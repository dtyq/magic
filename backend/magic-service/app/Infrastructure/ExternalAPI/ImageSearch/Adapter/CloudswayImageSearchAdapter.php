<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageSearch\Adapter;

use App\Infrastructure\ExternalAPI\ImageSearch\CloudswayImageSearch;
use App\Infrastructure\ExternalAPI\ImageSearch\DTO\ImageResultItemDTO;
use App\Infrastructure\ExternalAPI\ImageSearch\DTO\ImagesDTO;
use App\Infrastructure\ExternalAPI\ImageSearch\DTO\ImageSearchResponseDTO;

/**
 * Cloudsway image search engine adapter.
 * Converts Cloudsway Image Search API response to unified format.
 */
class CloudswayImageSearchAdapter implements ImageSearchEngineAdapterInterface
{
    private array $providerConfig;

    public function __construct(
        private readonly CloudswayImageSearch $cloudswayImageSearch,
        array $providerConfig = []
    ) {
        $this->providerConfig = $providerConfig;
    }

    public function imageSearch(
        string $query,
        int $count = 10,
        int $offset = 0
    ): ImageSearchResponseDTO {
        $apiKey = $this->providerConfig['api_key'] ?? '';
        $requestUrl = $this->providerConfig['request_url'] ?? '';

        // Call CloudswayImageSearch service
        $rawResponse = $this->cloudswayImageSearch->search(
            $query,
            $apiKey,
            $count,
            $offset,
            $requestUrl,
        );

        // Convert to unified format
        return $this->convertToUnifiedFormat($rawResponse);
    }

    public function convertToUnifiedFormat(array $rawResponse): ImageSearchResponseDTO
    {
        $response = new ImageSearchResponseDTO();

        // Cloudsway Image Search returns format with 'webPages' structure
        if (isset($rawResponse['webPages'])) {
            $images = new ImagesDTO();
            $images->setTotalEstimatedMatches($rawResponse['webPages']['totalEstimatedMatches'] ?? 0);

            $items = [];
            foreach ($rawResponse['webPages']['value'] ?? [] as $item) {
                $resultItem = new ImageResultItemDTO();

                // Map Cloudsway fields to unified format
                $resultItem->setContentUrl($item['imageUrl'] ?? '');
                $resultItem->setName($item['name'] ?? '');

                // Set width and height from image metadata
                $resultItem->setWidth((int) ($item['image']['width'] ?? 0));
                $resultItem->setHeight((int) ($item['image']['height'] ?? 0));

                // Content size and encoding format may not be provided
                $resultItem->setContentSize($item['contentSize'] ?? '');
                $resultItem->setEncodingFormat($item['encodingFormat'] ?? $this->extractFormatFromUrl($item['imageUrl'] ?? ''));

                // Optional fields
                if (! empty($item['url'])) {
                    $resultItem->setHostPageUrl($item['url']);
                }
                if (! empty($item['thumbnailUrl'])) {
                    $resultItem->setThumbnailUrl($item['thumbnailUrl']);
                }
                if (! empty($item['datePublished'])) {
                    $resultItem->setDatePublished($item['datePublished']);
                }

                $items[] = $resultItem;
            }
            $images->setValue($items);
            $response->setImages($images);
        }

        return $response;
    }

    public function getEngineName(): string
    {
        return 'cloudsway';
    }

    public function isAvailable(): bool
    {
        return ! empty($this->providerConfig['request_url'])
            && ! empty($this->providerConfig['api_key']);
    }

    /**
     * Extract image format from URL.
     */
    private function extractFormatFromUrl(string $url): string
    {
        $extension = pathinfo(parse_url($url, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION);
        return strtolower($extension);
    }
}
