<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\JinaSearch;
use Hyperf\Contract\ConfigInterface;

/**
 * Jina Search API adapter.
 * Converts Jina's response format to Bing-compatible format.
 */
class JinaSearchAdapter implements SearchEngineAdapterInterface
{
    public function __construct(
        private readonly JinaSearch $jinaSearch,
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
        $apiKey = $this->config->get('search.jina.api_key');

        // Call Jina search with all parameters
        // The service now handles parameter mapping internally
        $rawResponse = $this->jinaSearch->search(
            $query,
            $apiKey,
            $mkt,
            $count,
            $offset,
            $safeSearch,
            $freshness,
            $setLang
        );

        // Convert Jina response to unified Bing-compatible format
        return $this->convertToUnifiedFormat($rawResponse);
    }

    public function getEngineName(): string
    {
        return 'jina';
    }

    public function isAvailable(): bool
    {
        // Jina can work without API key, but better with it
        return true;
    }

    /**
     * Convert Jina response to Bing-compatible format.
     */
    private function convertToUnifiedFormat(array $jinaResponse): array
    {
        return [
            'webPages' => [
                'totalEstimatedMatches' => count($jinaResponse),
                'value' => array_map(function ($item, $index) {
                    return [
                        'id' => (string) $index,
                        'name' => $item['title'] ?? '',
                        'url' => $item['url'] ?? '',
                        'snippet' => $item['content'] ?? $item['description'] ?? '',
                        'displayUrl' => $this->extractDomain($item['url'] ?? ''),
                        'dateLastCrawled' => '', // Jina doesn't provide this
                    ];
                }, $jinaResponse, array_keys($jinaResponse)),
            ],
            '_rawResponse' => $jinaResponse,
        ];
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
