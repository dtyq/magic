<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageSearch\Adapter;

use App\Infrastructure\ExternalAPI\ImageSearch\DTO\ImageResultItemDTO;
use App\Infrastructure\ExternalAPI\ImageSearch\DTO\ImagesDTO;
use App\Infrastructure\ExternalAPI\ImageSearch\DTO\ImageSearchResponseDTO;
use App\Infrastructure\ExternalAPI\ImageSearch\SerpApiImageSearch;

/**
 * SerpApi image search engine adapter (for Google Images).
 * Converts SerpApi response to unified format.
 */
class SerpApiImageSearchAdapter implements ImageSearchEngineAdapterInterface
{
    private array $providerConfig;

    public function __construct(
        private readonly SerpApiImageSearch $serpApiImageSearch,
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

        // Call SerpApiImageSearch service
        $rawResponse = $this->serpApiImageSearch->search(
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

        // SerpApi returns format with 'images_results' array
        if (isset($rawResponse['images_results'])) {
            $images = new ImagesDTO();

            // SerpApi doesn't provide total count directly, use array count as approximation
            $totalResults = count($rawResponse['images_results']);
            $images->setTotalEstimatedMatches($totalResults);

            $items = [];
            foreach ($rawResponse['images_results'] ?? [] as $item) {
                $resultItem = new ImageResultItemDTO();

                // Map SerpApi fields to unified format
                $resultItem->setContentUrl($item['original'] ?? '');
                $resultItem->setName($item['title'] ?? '');
                $resultItem->setWidth((int) ($item['original_width'] ?? 0));
                $resultItem->setHeight((int) ($item['original_height'] ?? 0));

                // SerpApi doesn't provide contentSize, use empty or estimate
                $resultItem->setContentSize('');

                // Extract format from URL or use empty
                $encodingFormat = $this->extractFormatFromUrl($item['original'] ?? '');
                $resultItem->setEncodingFormat($encodingFormat);

                // Optional fields
                if (! empty($item['link'])) {
                    $resultItem->setHostPageUrl($item['link']);
                }
                if (! empty($item['thumbnail'])) {
                    $resultItem->setThumbnailUrl($item['thumbnail']);
                }

                // SerpApi doesn't provide datePublished for images
                $resultItem->setDatePublished('');

                $items[] = $resultItem;
            }
            $images->setValue($items);
            $response->setImages($images);
        }

        return $response;
    }

    public function getEngineName(): string
    {
        return 'google';
    }

    public function isAvailable(): bool
    {
        return ! empty($this->providerConfig['api_key']);
    }

    /**
     * Extract image format from URL.
     *
     * @param string $url Image URL
     * @return string Format (e.g., 'jpeg', 'png', 'gif')
     */
    private function extractFormatFromUrl(string $url): string
    {
        // Extract file extension from URL
        $path = parse_url($url, PHP_URL_PATH);
        if ($path === null) {
            return '';
        }

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        // Common image formats
        $validFormats = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'bmp', 'svg'];

        if (in_array($extension, $validFormats, true)) {
            // Normalize jpg to jpeg
            return $extension === 'jpg' ? 'jpeg' : $extension;
        }

        return '';
    }
}
