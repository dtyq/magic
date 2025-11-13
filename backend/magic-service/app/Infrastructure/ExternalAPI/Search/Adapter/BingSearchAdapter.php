<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\BingSearch;
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
    ): array {
        $apiKey = $this->config->get('search.bing.api_key');

        // Call original BingSearch with all parameters
        return $this->bingSearch->search(
            $query,
            $apiKey,
            $mkt,
            $count,
            $offset,
            $safeSearch,
            $freshness,
            $setLang
        );

        // Bing already returns the standard format, so return directly
        // Note: We don't add _rawResponse here to avoid duplication
    }

    public function getEngineName(): string
    {
        return 'bing';
    }

    public function isAvailable(): bool
    {
        return ! empty($this->config->get('search.bing.api_key'));
    }
}
