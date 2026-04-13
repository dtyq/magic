<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search;

use App\Infrastructure\Core\Traits\HasLogger;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\BadResponseException;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use Hyperf\Contract\ConfigInterface;
use RuntimeException;
use Throwable;

class BaiduSearch
{
    use HasLogger;

    private const string DEFAULT_ENDPOINT = 'https://qianfan.baidubce.com/v2/ai_search/web_search';

    private const int DEFAULT_SEARCH_ENGINE_TIMEOUT = 10;

    public function __construct(protected readonly ConfigInterface $config)
    {
    }

    /**
     * Execute Baidu Qianfan web search with unified parameters.
     *
     * @return array Native Baidu API response
     */
    public function search(
        string $query,
        string $apiKey,
        string $requestUrl = '',
        int $count = 20,
        int $offset = 0,
        string $safeSearch = '',
        string $freshness = ''
    ): array {
        $client = new Client();
        $requestUrl = trim($requestUrl) !== ''
            ? trim($requestUrl)
            : (string) $this->config->get('search.drivers.baidu.endpoint', self::DEFAULT_ENDPOINT);

        // Baidu search does not expose offset pagination. Request a larger window and slice later.
        $fetchCount = max(1, min(50, $count + max(0, $offset)));

        $payload = [
            'messages' => [
                [
                    'content' => $query,
                    'role' => 'user',
                ],
            ],
            'search_source' => 'baidu_search_v2',
            'resource_type_filter' => [
                [
                    'type' => 'web',
                    'top_k' => $fetchCount,
                ],
            ],
        ];

        $safeSearchFlag = $this->normalizeSafeSearch($safeSearch);
        if ($safeSearchFlag !== null) {
            $payload['safe_search'] = $safeSearchFlag;
        }

        $recencyFilter = $this->normalizeFreshness($freshness);
        if ($recencyFilter !== null) {
            $payload['search_recency_filter'] = $recencyFilter;
        }

        try {
            $options = [
                'headers' => [
                    'Authorization' => 'Bearer ' . $apiKey,
                    'X-Appbuilder-Authorization' => 'Bearer ' . $apiKey,
                    'Content-Type' => 'application/json',
                ],
                'json' => $payload,
                'timeout' => self::DEFAULT_SEARCH_ENGINE_TIMEOUT,
            ];

            $proxy = $this->config->get('odin.http.proxy');
            if (! empty($proxy)) {
                $options['proxy'] = $proxy;
            }

            $response = $client->post($requestUrl, $options);
            $decoded = Json::decode($response->getBody()->getContents());

            if (! is_array($decoded)) {
                throw new RuntimeException('Baidu search returned an invalid response.');
            }

            if (! empty($decoded['code'])) {
                $message = (string) ($decoded['message'] ?? 'Baidu search error.');
                throw new RuntimeException(sprintf('Baidu search error [%s]: %s', $decoded['code'], $message));
            }

            return $decoded;
        } catch (BadResponseException|RequestException $e) {
            $responseBody = $e->getResponse()?->getBody()->getContents() ?? '';
            $this->logger->error(sprintf(
                '百度搜索请求失败:%s,file:%s,line:%s',
                $responseBody !== '' ? $responseBody : $e->getMessage(),
                $e->getFile(),
                $e->getLine()
            ));
            throw new RuntimeException('Baidu search request failed: ' . ($responseBody !== '' ? $responseBody : $e->getMessage()), 0, $e);
        } catch (Throwable $e) {
            $this->logger->error('百度搜索遇到错误:' . $e->getMessage());
            throw new RuntimeException('Baidu search failed: ' . $e->getMessage(), 0, $e);
        }
    }

    private function normalizeSafeSearch(string $safeSearch): ?bool
    {
        return match (strtolower($safeSearch)) {
            'strict', 'moderate' => true,
            'off' => false,
            default => null,
        };
    }

    private function normalizeFreshness(string $freshness): ?string
    {
        return match (strtolower($freshness)) {
            'week' => 'week',
            'month' => 'month',
            default => null,
        };
    }
}
