<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search\Adapter;

use App\Infrastructure\ExternalAPI\Search\DeepSeekSearch;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResponseDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResultItemDTO;
use App\Infrastructure\ExternalAPI\Search\DTO\WebPagesDTO;

class DeepSeekSearchAdapter implements SearchEngineAdapterInterface
{
    private array $providerConfig;

    /**
     * 注入 DeepSeek 请求服务和后台提供商配置，保持统一搜索适配器的调用边界。
     */
    public function __construct(
        private readonly DeepSeekSearch $deepSeekSearch,
        array $providerConfig = []
    ) {
        $this->providerConfig = $providerConfig;
    }

    /**
     * 将统一搜索参数转换为 DeepSeek Search 请求，并在 50 条窗口内完成本地分页。
     */
    public function search(
        string $query,
        string $mkt,
        int $count = 20,
        int $offset = 0,
        string $safeSearch = '',
        string $freshness = '',
        string $setLang = ''
    ): SearchResponseDTO {
        if ($offset >= 50) {
            $response = $this->convertToUnifiedFormat(['results' => []]);
            $response->setWarning('DeepSeek search supports a maximum result window of 50 items.');
            return $response;
        }

        $fetchCount = min(50, $offset + $count);
        $rawResponse = $this->deepSeekSearch->search(
            $query,
            (string) ($this->providerConfig['api_key'] ?? ''),
            (string) ($this->providerConfig['request_url'] ?? ''),
            $fetchCount
        );

        $response = $this->convertToUnifiedFormat($rawResponse);
        if ($offset > 0 || $offset + $count > 50) {
            $response->setWarning('DeepSeek search supports a maximum result window of 50 items.');
        }

        $webPages = $response->getWebPages();
        if ($webPages !== null) {
            $webPages->setValue(array_values(array_slice($webPages->getValue(), $offset, $count)));
        }

        return $response;
    }

    /**
     * 将 DeepSeek results 映射为现有统一搜索响应；第一期只使用 snippet，不使用正文。
     *
     * @param array<string, mixed> $deepSeekResponse
     */
    public function convertToUnifiedFormat(array $deepSeekResponse): SearchResponseDTO
    {
        $response = new SearchResponseDTO();
        $response->setRawResponse($deepSeekResponse);

        $results = $deepSeekResponse['results'] ?? [];
        if (! is_array($results)) {
            $results = [];
        }

        $webPages = new WebPagesDTO();
        $webPages->setTotalEstimatedMatches(count($results));

        $resultItems = [];
        foreach ($results as $index => $item) {
            if (! is_array($item)) {
                continue;
            }

            $url = (string) ($item['url'] ?? '');
            $resultItem = new SearchResultItemDTO();
            $resultItem->setId((string) ($item['id'] ?? ($index + 1)));
            $resultItem->setName((string) ($item['title'] ?? ''));
            $resultItem->setUrl($url);
            $resultItem->setSnippet((string) ($item['snippet'] ?? ''));
            $resultItem->setDisplayUrl((string) ($item['site_name'] ?? $this->resolveHost($url)));
            $resultItem->setDateLastCrawled((string) ($item['date'] ?? ''));
            if (isset($item['rerank_score']) && is_numeric($item['rerank_score'])) {
                $resultItem->setScore((float) $item['rerank_score']);
            }
            $resultItems[] = $resultItem;
        }

        $webPages->setValue($resultItems);
        $webPages->setTotalEstimatedMatches(count($resultItems));
        $response->setWebPages($webPages);

        return $response;
    }

    /**
     * 返回统一搜索引擎标识，供调用审计和响应元数据使用。
     */
    public function getEngineName(): string
    {
        return 'deepseek';
    }

    /**
     * 请求地址可回退到默认端点，因此只要求配置密钥。
     */
    public function isAvailable(): bool
    {
        return trim((string) ($this->providerConfig['api_key'] ?? '')) !== '';
    }

    /**
     * 从结果 URL 提取域名作为统一响应的展示地址，解析失败时返回空字符串。
     */
    private function resolveHost(string $url): string
    {
        $host = parse_url($url, PHP_URL_HOST);
        return is_string($host) ? $host : '';
    }
}
