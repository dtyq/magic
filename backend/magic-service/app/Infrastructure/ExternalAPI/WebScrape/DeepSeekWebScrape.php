<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\WebScrape;

use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Exception\TransferException;
use Hyperf\Codec\Json;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

/**
 * DeepSeek Fetch 网页抓取实现。
 */
class DeepSeekWebScrape extends AbstractWebScrape
{
    private const int MAX_ATTEMPTS = 2;

    private const int RETRY_DELAY_MICROSECONDS = 200_000;

    private string $requestUrl;

    private string $apiKey;

    /**
     * 注入后台保存的请求地址和密钥；缺少任一配置时禁止启用该提供商。
     */
    public function configure(array $config): void
    {
        $this->requestUrl = (string) ($config['request_url'] ?? '');
        $this->apiKey = (string) ($config['api_key'] ?? '');

        if (isset($config['timeout'])) {
            $this->setTimeout((int) $config['timeout']);
        }

        if ($this->requestUrl === '' || $this->apiKey === '') {
            throw new InvalidArgumentException('Missing required configuration: request_url or api_key');
        }
    }

    /**
     * 返回网页抓取提供商标识，供统一响应和日志记录使用。
     */
    public function getPlatformName(): string
    {
        return 'deepseek';
    }

    /**
     * 调用 DeepSeek Fetch 并统一返回 Markdown 内容。
     *
     * DeepSeek Fetch 只返回 Markdown，因此调用方传入的格式不会改变上游请求；
     * 为保持现有 WebScrape 客户端契约，返回内容统一包装为 content.markdown。
     */
    public function scrape(string $url, array $formats, string $mode, array $options = []): WebScrapeResponse
    {
        // DeepSeek 仅支持 Markdown：格式请求统一降级，不因 TEXT/HTML/空格式失败。
        $effectiveFormats = ['MARKDOWN'];
        $this->validateRequest($url, $effectiveFormats);
        $this->logRequest($url, ['url' => $url]);

        $lastException = null;
        for ($attempt = 0; $attempt < self::MAX_ATTEMPTS; ++$attempt) {
            try {
                $startTime = microtime(true);
                $response = $this->httpClient->request('POST', $this->requestUrl, [
                    'headers' => [
                        'Authorization' => 'Bearer ' . $this->apiKey,
                        'Content-Type' => 'application/json',
                    ],
                    'json' => ['url' => $url],
                    'http_errors' => true,
                ]);

                $data = Json::decode($response->getBody()->getContents());
                if (! is_array($data) || ! isset($data['content']) || ! is_string($data['content'])) {
                    throw new RuntimeException('DeepSeek Fetch returned an invalid response.');
                }

                $metadata = [
                    'duration_ms' => (int) ((microtime(true) - $startTime) * 1000),
                    'status_code' => $response->getStatusCode(),
                    'title' => (string) ($data['title'] ?? ''),
                    'actual_format' => 'MARKDOWN',
                ];

                $this->logResponse($url, true);

                return WebScrapeResponse::success(
                    url: $url,
                    content: [
                        'markdown' => $data['content'],
                        'site_name' => '',
                        'logo' => null,
                        'image_list' => [],
                    ],
                    provider: $this->getPlatformName(),
                    formats: $effectiveFormats,
                    metadata: $metadata
                );
            } catch (TransferException $e) {
                $lastException = $e;
                $statusCode = $e instanceof RequestException
                    ? $e->getResponse()?->getStatusCode()
                    : null;
                $retryable = $this->isRetryableStatus($statusCode);

                $this->logger->warning('DeepSeek WebScrape request failed.', [
                    'status_code' => $statusCode,
                    'attempt' => $attempt + 1,
                    'retryable' => $retryable,
                ]);

                if (! $retryable || $attempt + 1 >= self::MAX_ATTEMPTS) {
                    break;
                }

                usleep(self::RETRY_DELAY_MICROSECONDS);
            } catch (Throwable $e) {
                $lastException = $e;
                break;
            }
        }

        $error = $lastException?->getMessage() ?? 'Unknown error';
        $this->logResponse($url, false, $error);
        throw new RuntimeException('DeepSeek WebScrape error: ' . $error, 0, $lastException);
    }

    /**
     * 仅对临时性网络或上游故障重试；鉴权、参数和资源不存在等错误直接失败。
     */
    private function isRetryableStatus(?int $statusCode): bool
    {
        return $statusCode === null || in_array($statusCode, [408, 429, 500, 504], true);
    }
}
