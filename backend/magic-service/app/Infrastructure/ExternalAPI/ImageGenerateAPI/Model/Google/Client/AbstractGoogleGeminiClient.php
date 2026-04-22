<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\Client;

use App\Infrastructure\Util\Http\GuzzleClientFactory;
use Exception;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;

use function Hyperf\Translation\__;

abstract class AbstractGoogleGeminiClient implements GoogleGeminiInterface
{
    protected const REQUEST_TIMEOUT = 300;

    protected array $config;

    protected string $modelId;

    protected ?string $proxyUrl;

    protected LoggerInterface $logger;

    protected Redis $redis;

    public function __construct(
        array $config,
        string $modelId = 'gemini-2.5-flash-image',
        ?string $proxyUrl = null,
    ) {
        $this->config = $config;
        $this->modelId = trim($modelId);
        $this->proxyUrl = $proxyUrl;
        $this->logger = di(LoggerFactory::class)->get(static::class);
        $this->redis = di(Redis::class);
        $this->validateConfig();
    }

    public function setModelId(string $modelId): void
    {
        $this->modelId = $modelId;
    }

    public function generateContent(string $prompt, array $images = [], array $config = []): array
    {
        $parts = [];

        // 处理图片
        if (! empty($images)) {
            // 限制最多14张图像
            $images = array_slice($images, 0, 14);
            foreach ($images as $image) {
                $parts[] = $this->formatImagePart($image);
            }
        }

        // 添加文本提示词
        $parts[] = ['text' => $prompt];

        $contents = [
            [
                'role' => 'user',
                'parts' => $parts,
            ],
        ];

        // 合并默认配置和传入配置
        // 注意：这里我们设定了一些默认值，如果 $config 中有传入，会覆盖默认值
        // 对于纯文生图场景，可能需要调整默认参数，但目前保持统一即可
        $defaultConfig = [
            'temperature' => 0.7,
            'candidateCount' => 1,
            'maxOutputTokens' => 2048,
        ];

        // 如果是图生图（有图片），使用更宽松的默认配置
        if (! empty($images)) {
            $defaultConfig = [
                'temperature' => 1,
                'maxOutputTokens' => 32768,
                'responseModalities' => ['TEXT', 'IMAGE'],
                'topP' => 0.95,
            ];
        }

        $generationConfig = array_merge($defaultConfig, $config);

        if (isset($config['imageConfig']) && is_array($config['imageConfig'])) {
            $generationConfig['imageConfig'] = $config['imageConfig'];
        }

        return $this->makeGenerateRequest($contents, $generationConfig);
    }

    abstract protected function validateConfig(): void;

    abstract protected function getAuthHeaders(): array;

    protected function makeGenerateRequest(array $contents, ?array $generationConfig = null, ?array $safetySettings = null): array
    {
        if ($generationConfig === null) {
            $generationConfig = [
                'temperature' => 1,
                'maxOutputTokens' => 32768,
                'responseModalities' => ['TEXT', 'IMAGE'],
                'topP' => 0.95,
            ];
        }

        if ($safetySettings === null) {
            $safetySettings = $this->getDefaultSafetySettings();
        }

        $payload = [
            'contents' => $contents,
            'generationConfig' => $generationConfig,
            'safetySettings' => $safetySettings,
        ];

        return $this->makeRequest('generateContent', $payload);
    }

    protected function makeRequest(string $endpoint, array $payload): array
    {
        $url = $this->buildUrl($endpoint);
        $client = GuzzleClientFactory::createProxyClient(['timeout' => self::REQUEST_TIMEOUT], $this->proxyUrl);

        $attempts = 0;
        $maxAttempts = 2; // 允许重试一次

        while ($attempts < $maxAttempts) {
            ++$attempts;

            // 每次请求前重新获取 Headers，确保重试时使用新 Token
            $headers = array_merge(['Content-Type' => 'application/json'], $this->getAuthHeaders());

            $this->logger->info('Google Gemini API 请求', [
                'url' => $url,
                'client_class' => static::class,
                'payload' => $payload,
                'attempt' => $attempts,
            ]);

            try {
                $response = $client->post($url, [
                    'headers' => $headers,
                    'json' => $payload,
                    'http_errors' => false,
                ]);

                $statusCode = $response->getStatusCode();

                // 处理 401 未授权错误，尝试刷新凭证并重试
                if ($statusCode === 401 && $attempts < $maxAttempts) {
                    if ($this->refreshAuth()) {
                        $this->logger->warning('Google Gemini API 401 Unauthorized, refreshing token and retrying...', [
                            'url' => $url,
                            'attempt' => $attempts,
                        ]);
                        continue;
                    }
                }

                if ($response->getStatusCode() === 404) {
                    throw new Exception(__('image_generate.google_gemini_model_or_endpoint_not_found'));
                }

                $result = Json::decode($response->getBody()->getContents());
                if ($statusCode === 200) {
                    $this->logger->info('Google Gemini API usage', [
                        'usageMetadata' => $result['usageMetadata'],
                    ]);
                    return $result;
                }

                $errorMessage = $result['error']['message'] ?? __('image_generate.http_error', ['status' => $statusCode]);
                throw new Exception(__('image_generate.api_request_failed_with_error', ['error' => $errorMessage]));
            } catch (Exception $e) {
                // 如果是最后一次尝试，或者非 401 错误
                $this->logger->error('Google Gemini API 请求失败', [
                    'error' => $e->getMessage(),
                    'url' => $url,
                    'attempt' => $attempts,
                ]);
                throw $e;
            }
        }

        throw new Exception(__('image_generate.api_request_failed_after_retries'));
    }

    /**
     * 刷新认证凭证（如清除 Token 缓存）
     * 子类需实现此方法以支持 401 自动重试.
     * @return bool 是否成功执行了刷新操作
     */
    protected function refreshAuth(): bool
    {
        return false;
    }

    protected function getDefaultSafetySettings(): array
    {
        return [
            [
                'category' => 'HARM_CATEGORY_HATE_SPEECH',
                'threshold' => 'BLOCK_NONE',
            ],
            [
                'category' => 'HARM_CATEGORY_DANGEROUS_CONTENT',
                'threshold' => 'BLOCK_NONE',
            ],
            [
                'category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                'threshold' => 'BLOCK_NONE',
            ],
            [
                'category' => 'HARM_CATEGORY_HARASSMENT',
                'threshold' => 'BLOCK_NONE',
            ],
        ];
    }

    abstract protected function buildUrl(string $endpoint): string;

    protected function formatImagePart(array $image): array
    {
        if (isset($image['type']) && $image['type'] === 'fileData') {
            return [
                'fileData' => [
                    'mimeType' => $image['mimeType'],
                    'fileUri' => $image['fileUri'],
                ],
            ];
        }

        if (isset($image['type']) && $image['type'] === 'base64') {
            return [
                'inlineData' => [
                    'mimeType' => $image['mimeType'],
                    'data' => $image['data'],
                ],
            ];
        }

        throw new Exception(__('image_generate.unsupported_image_data_type'));
    }
}
