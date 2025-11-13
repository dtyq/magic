<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

/**
 * Search engine adapter interface.
 * All search engine adapters must implement this interface to provide unified search functionality.
 */
interface SearchEngineAdapterInterface
{
    /**
     * Execute search with unified parameters and return unified response format (Bing-compatible).
     *
     * @param string $query Search query keywords
     * @param string $mkt Market code (e.g., zh-CN, en-US)
     * @param int $count Number of results (1-50)
     * @param int $offset Pagination offset (0-1000)
     * @param string $safeSearch Safe search level (Strict/Moderate/Off)
     * @param string $freshness Time filter (Day/Week/Month)
     * @param string $setLang UI language code
     * @return array Unified Bing-compatible format response with structure:
     *               [
     *               'webPages' => [
     *               'totalEstimatedMatches' => int,
     *               'value' => [
     *               [
     *               'id' => string,
     *               'name' => string,      // title
     *               'url' => string,
     *               'snippet' => string,   // description
     *               'displayUrl' => string (optional),
     *               'dateLastCrawled' => string (optional),
     *               ],
     *               ...
     *               ]
     *               ],
     *               '_rawResponse' => array (optional, for debugging),
     *               ]
     */
    public function search(
        string $query,
        string $mkt,
        int $count = 20,
        int $offset = 0,
        string $safeSearch = '',
        string $freshness = '',
        string $setLang = ''
    ): array;

    /**
     * Get search engine name.
     *
     * @return string Engine name (e.g., 'bing', 'google', 'tavily')
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
