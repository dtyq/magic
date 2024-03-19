<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageSearch\Adapter;

use App\Infrastructure\ExternalAPI\ImageSearch\DTO\ImageSearchResponseDTO;

/**
 * Image search engine adapter interface.
 * All image search engine adapters must implement this interface to provide unified image search functionality.
 */
interface ImageSearchEngineAdapterInterface
{
    /**
     * Execute image search with unified parameters and return unified response format.
     *
     * @param string $query Search query keywords
     * @param int $count Number of results (1-50)
     * @param int $offset Pagination offset (0-1000)
     * @return ImageSearchResponseDTO Unified image search response with images data
     */
    public function imageSearch(
        string $query,
        int $count = 10,
        int $offset = 0
    ): ImageSearchResponseDTO;

    /**
     * Convert raw search engine response to unified format.
     *
     * @param array $rawResponse Raw response from search engine API
     * @return ImageSearchResponseDTO Unified image search response DTO
     */
    public function convertToUnifiedFormat(array $rawResponse): ImageSearchResponseDTO;

    /**
     * Get search engine name.
     *
     * @return string Engine name (e.g., 'bing', 'google', 'serpapi')
     */
    public function getEngineName(): string;

    /**
     * Check if search engine is available.
     * Usually checks if API keys are configured properly.
     *
     * @return bool True if engine is available, false otherwise
     */
    public function isAvailable(): bool;
}
