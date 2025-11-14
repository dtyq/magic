<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\GoogleSearch;
use Hyperf\Contract\ConfigInterface;

/**
 * Google Custom Search API adapter.
 * Converts Google's response format to Bing-compatible format.
 */
class GoogleSearchAdapter implements SearchEngineAdapterInterface
{
    public function __construct(
        private readonly GoogleSearch $googleSearch,
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
    ): array {
        $apiKey = $this->config->get('search.google.api_key');
        $cx = $this->config->get('search.google.cx');

        // Call GoogleSearch with all parameters
        $rawResponse = $this->googleSearch->search(
            $query,
            $apiKey,
            $cx,
            $mkt,
            $count,
            $offset,
            $safeSearch,
            $freshness,
            $setLang
        );

        // Convert Google response to unified Bing-compatible format
        return $this->convertToUnifiedFormat($rawResponse);
    }

    public function getEngineName(): string
    {
        return 'google';
    }

    public function isAvailable(): bool
    {
        return ! empty($this->config->get('search.google.api_key'))
            && ! empty($this->config->get('search.google.cx'));
    }

    /**
     * Convert Google Custom Search response to Bing-compatible format.
     */
    private function convertToUnifiedFormat(array $googleResponse): array
    {
        $items = $googleResponse['items'] ?? [];
        $totalResults = (int) ($googleResponse['searchInformation']['totalResults'] ?? 0);

        return [
            'webPages' => [
                'totalEstimatedMatches' => $totalResults,
                'value' => array_map(function ($item) {
                    return [
                        'id' => $item['cacheId'] ?? uniqid('google_'),
                        'name' => $item['title'] ?? '',
                        'url' => $item['link'] ?? '',
                        'snippet' => $item['snippet'] ?? '',
                        'displayUrl' => $item['displayLink'] ?? '',
                        'dateLastCrawled' => '', // Google doesn't provide this
                    ];
                }, $items),
            ],
            '_rawResponse' => $googleResponse,
        ];
    }
}
