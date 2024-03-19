<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageSearch\Adapter;

use App\Infrastructure\ExternalAPI\ImageSearch\BingImageSearch;
use App\Infrastructure\ExternalAPI\ImageSearch\DTO\ImageResultItemDTO;
use App\Infrastructure\ExternalAPI\ImageSearch\DTO\ImagesDTO;
use App\Infrastructure\ExternalAPI\ImageSearch\DTO\ImageSearchResponseDTO;

/**
 * Bing image search engine adapter.
 * Converts Bing Image Search API response to unified format.
 */
class BingImageSearchAdapter implements ImageSearchEngineAdapterInterface
{
    private array $providerConfig;

    public function __construct(
        private readonly BingImageSearch $bingImageSearch,
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

        // Call BingImageSearch service
        $rawResponse = $this->bingImageSearch->search(
            $query,
            $apiKey,
            $count,
            $offset,
            $requestUrl
        );

        // Convert to unified format
        return $this->convertToUnifiedFormat($rawResponse);
    }

    public function convertToUnifiedFormat(array $rawResponse): ImageSearchResponseDTO
    {
        $response = new ImageSearchResponseDTO();

        // Bing Image Search returns format with 'value' array
        if (isset($rawResponse['value'])) {
            $images = new ImagesDTO();
            $images->setTotalEstimatedMatches($rawResponse['totalEstimatedMatches'] ?? 0);

            $items = [];
            foreach ($rawResponse['value'] ?? [] as $item) {
                $resultItem = new ImageResultItemDTO();
                $resultItem->setContentUrl($item['contentUrl'] ?? '');
                $resultItem->setName($item['name'] ?? '');
                $resultItem->setWidth((int) ($item['width'] ?? 0));
                $resultItem->setHeight((int) ($item['height'] ?? 0));
                $resultItem->setContentSize($item['contentSize'] ?? '');
                $resultItem->setEncodingFormat($item['encodingFormat'] ?? '');

                // Optional fields
                if (! empty($item['hostPageUrl'])) {
                    $resultItem->setHostPageUrl($item['hostPageUrl']);
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
        return 'bing';
    }

    public function isAvailable(): bool
    {
        return ! empty($this->providerConfig['request_url'])
            && ! empty($this->providerConfig['api_key']);
    }
}
