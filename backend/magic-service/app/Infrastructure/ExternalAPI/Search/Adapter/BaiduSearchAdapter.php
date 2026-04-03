<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\BaiduSearch;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResponseDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResultItemDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\WebPagesDTO;

class BaiduSearchAdapter implements SearchEngineAdapterInterface
{
    private array $providerConfig;

    public function __construct(
        private readonly BaiduSearch $baiduSearch,
        array $providerConfig = []
    ) {
        $this->providerConfig = $providerConfig;
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
        $requestUrl = $this->providerConfig['request_url'] ?? '';
        $apiKey = $this->providerConfig['api_key'] ?? '';

        $rawResponse = $this->baiduSearch->search(
            $query,
            $apiKey,
            $requestUrl,
            $count,
            $offset,
            $safeSearch,
            $freshness
        );

        $response = $this->convertToUnifiedFormat($this->sliceReferences($rawResponse, $offset, $count));

        if ($offset > 0) {
            $response->setWarning('Baidu search does not support native offset pagination; results are windowed locally.');
        }

        return $response;
    }

    public function convertToUnifiedFormat(array $baiduResponse): SearchResponseDTO
    {
        $response = new SearchResponseDTO();
        $response->setRawResponse($baiduResponse);

        $references = array_values(array_filter(
            $baiduResponse['references'] ?? [],
            static fn (array $item): bool => ($item['type'] ?? 'web') === 'web'
        ));

        $webPages = new WebPagesDTO();
        $webPages->setTotalEstimatedMatches(count($references));

        $resultItems = [];
        foreach ($references as $index => $item) {
            $resultItem = new SearchResultItemDTO();
            $resultItem->setId((string) ($item['id'] ?? ($index + 1)));
            $resultItem->setName((string) ($item['title'] ?? ''));
            $resultItem->setUrl((string) ($item['url'] ?? ''));
            $resultItem->setSnippet((string) ($item['content'] ?? $item['snippet'] ?? ''));
            $resultItem->setDisplayUrl($this->resolveDisplayUrl($item));
            $resultItem->setDateLastCrawled((string) ($item['date'] ?? ''));
            $resultItems[] = $resultItem;
        }

        $webPages->setValue($resultItems);
        $response->setWebPages($webPages);

        return $response;
    }

    public function getEngineName(): string
    {
        return 'baidu';
    }

    public function isAvailable(): bool
    {
        return ! empty($this->providerConfig['api_key']);
    }

    private function resolveDisplayUrl(array $item): string
    {
        $displayUrl = (string) ($item['website'] ?? $item['web_anchor'] ?? '');
        if ($displayUrl !== '') {
            return $displayUrl;
        }

        $host = parse_url((string) ($item['url'] ?? ''), PHP_URL_HOST);
        return is_string($host) ? $host : '';
    }

    private function sliceReferences(array $response, int $offset, int $count): array
    {
        $references = $response['references'] ?? [];
        if (! is_array($references)) {
            $response['references'] = [];
            return $response;
        }

        $response['references'] = array_values(array_slice($references, max(0, $offset), max(1, $count)));
        return $response;
    }
}
