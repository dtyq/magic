<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\OpenRouter;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\AbstractImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\OpenRouterRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageUsage;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\Util\Context\CoContext;
use Exception;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use Hyperf\Coroutine\Parallel;
use Hyperf\Engine\Coroutine;
use Throwable;

class OpenRouterModel extends AbstractImageGenerate
{
    protected string $url = 'https://openrouter.ai/api/v1/chat/completions';

    protected string $apiKey;

    protected string $siteUrl = '';

    protected string $siteName = '';

    protected OpenRouterAPI $api;

    public function __construct(array $config)
    {
        $this->apiKey = $config['api_key'] ?? '';

        $url = empty($config['url']) ? $this->url : rtrim($config['url']);
        if (! empty($config['url']) && preg_match('#/api/v1/?$#', $url)) {
            $url = rtrim($url, '/') . '/chat/completions';
        }
        $this->url = $url;

        $proxyUrl = $config['proxy_url'] ?? null;
        $this->siteUrl = $config['site_url'] ?? '';
        $this->siteName = $config['site_name'] ?? '';

        $this->api = new OpenRouterAPI(
            $this->apiKey,
            $this->url,
            $this->siteUrl,
            $this->siteName,
            $proxyUrl
        );
    }

    public function generateImageOpenAIFormat(ImageGenerateRequest $imageGenerateRequest): OpenAIFormatResponse
    {
        if (! $imageGenerateRequest instanceof OpenRouterRequest) {
            $this->logger->error('OpenRouter OpenAI格式生图：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
            return OpenAIFormatResponse::buildError(ImageGenerateErrorCode::GENERAL_ERROR->value, 'Invalid request type');
        }

        // 1. 预先创建响应对象
        $response = new OpenAIFormatResponse([
            'created' => time(),
            'provider' => $this->getProviderName(),
            'data' => [],
        ]);

        // 2. 并发处理多张图片生成
        $count = $imageGenerateRequest->getGenerateNum();
        $parallel = new Parallel();
        $fromCoroutineId = Coroutine::id();

        for ($i = 0; $i < $count; ++$i) {
            $parallel->add(function () use ($imageGenerateRequest, $response, $fromCoroutineId) {
                CoContext::copy($fromCoroutineId);
                try {
                    // 发送请求并获取响应
                    $responseData = $this->requestImageGeneration($imageGenerateRequest);

                    // 验证响应格式，如果有错误则直接返回
                    $errorResponse = $this->validateOpenRouterResponse($responseData);
                    if ($errorResponse !== null) {
                        // 失败：设置错误信息到响应对象（只设置第一个错误）
                        if (! $response->hasError()) {
                            $response->setProviderErrorCode($errorResponse->getProviderErrorCode());
                            $response->setProviderErrorMessage($errorResponse->getProviderErrorMessage());
                        }
                        return;
                    }

                    // 从响应中提取图片数据
                    $images = $this->extractImagesFromResponse($responseData);

                    if (empty($images)) {
                        $this->logger->warning('OpenRouter：未找到图片数据', ['response' => $responseData]);
                        if (! $response->hasError()) {
                            $response->setProviderErrorCode(ImageGenerateErrorCode::NO_VALID_IMAGE->value);
                            $response->setProviderErrorMessage('No images found in response');
                        }
                        return;
                    }

                    // 处理水印并转换为URL格式，添加到响应对象
                    $this->addImageDataToResponse($response, $images, $responseData, $imageGenerateRequest);
                } catch (Exception $e) {
                    // 失败：设置错误信息到响应对象（只设置第一个错误）
                    if (! $response->hasError()) {
                        $response->setProviderErrorCode($e->getCode());
                        $response->setProviderErrorMessage($e->getMessage());
                    }

                    $this->logger->error('OpenRouter OpenAI格式生图：单个请求失败', [
                        'error_code' => $e->getCode(),
                        'error_message' => $e->getMessage(),
                    ]);
                }
            });
        }

        $parallel->wait();

        // 3. 记录最终结果
        $this->logger->info('OpenRouter OpenAI格式生图：并发处理完成', [
            '总请求数' => $count,
            '成功图片数' => count($response->getData()),
            '是否有错误' => $response->hasError(),
            '错误码' => $response->getProviderErrorCode(),
            '错误消息' => $response->getProviderErrorMessage(),
        ]);

        return $response;
    }

    public function generateImageRawWithWatermark(ImageGenerateRequest $imageGenerateRequest): array
    {
        $response = $this->generateImageOpenAIFormat($imageGenerateRequest);
        return $response->toArray();
    }

    public function getProviderName(): string
    {
        return 'OpenRouter';
    }

    public function generateImageRaw(ImageGenerateRequest $imageGenerateRequest): array
    {
        $response = $this->generateImageOpenAIFormat($imageGenerateRequest);
        return $response->toArray();
    }

    public function setAK(string $ak)
    {
        // Not used
    }

    public function setSK(string $sk)
    {
        // Not used
    }

    public function setApiKey(string $apiKey)
    {
        $this->apiKey = $apiKey;
    }

    protected function generateImageInternal(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        throw new Exception('OpenRouterModel does not support generateImageInternal method');
    }

    /**
     * 发送图片生成请求（带重试机制）.
     */
    private function requestImageGeneration(OpenRouterRequest $openRouterRequest): array
    {
        $maxRetries = 3;
        $retryCount = 0;
        $data = $openRouterRequest->toArray();
        $lastException = null;

        do {
            try {
                $this->logger->info('OpenRouter：发送图片生成请求', [
                    'url' => $this->url,
                    'retry_count' => $retryCount,
                ]);

                $responseData = $this->api->generateImage($data);

                $this->logger->info('OpenRouter：收到响应', [
                    'response_length' => strlen(Json::encode($responseData)),
                ]);

                return $responseData;
            } catch (GuzzleException|RequestException $e) {
                $lastException = $e;

                if (! $this->shouldRetry($e, $retryCount, $maxRetries)) {
                    break;
                }

                $this->logger->warning('OpenRouter：请求失败，准备重试', [
                    'retry_count' => $retryCount + 1,
                    'error' => $e->getMessage(),
                    'status_code' => $e instanceof RequestException && $e->hasResponse() ? $e->getResponse()->getStatusCode() : 'unknown',
                ]);

                sleep(1);
                ++$retryCount;
            } catch (Throwable $e) {
                $lastException = $e;
                break;
            }
        } while ($retryCount <= $maxRetries);

        throw $lastException;
    }

    /**
     * 验证OpenRouter API响应数据格式.
     *
     * @return null|OpenAIFormatResponse 如果有错误则返回错误响应，否则返回 null
     */
    private function validateOpenRouterResponse(array $responseData): ?OpenAIFormatResponse
    {
        if (isset($responseData['error'])) {
            $errorMessage = is_array($responseData['error']) ? Json::encode($responseData['error']) : $responseData['error'];
            return OpenAIFormatResponse::buildError(ImageGenerateErrorCode::GENERAL_ERROR->value, 'OpenRouter API Error: ' . $errorMessage);
        }

        if (! isset($responseData['choices']) || ! is_array($responseData['choices'])) {
            return OpenAIFormatResponse::buildError(ImageGenerateErrorCode::RESPONSE_FORMAT_ERROR->value, 'Invalid response format: missing choices field');
        }

        if (empty($responseData['choices'][0])) {
            return OpenAIFormatResponse::buildError(ImageGenerateErrorCode::RESPONSE_FORMAT_ERROR->value, 'Invalid response format: empty choices array');
        }

        return null;
    }

    /**
     * 从OpenRouter响应中提取图片数据.
     *
     * @return array 图片数组，格式为 [['url' => '...']] 或 [['b64_json' => '...']]
     */
    private function extractImagesFromResponse(array $responseData): array
    {
        $images = [];

        // 优先从 images 字段提取
        if (isset($responseData['choices'][0]['message']['images'])) {
            foreach ($responseData['choices'][0]['message']['images'] as $image) {
                if (($image['thought'] ?? false) === true || ($image['image_url']['thought'] ?? false) === true) {
                    $this->logger->info('OpenRouter响应：检测到思考图，已过滤');
                    continue;
                }

                if (isset($image['image_url']['url'])) {
                    $images[] = ['url' => $image['image_url']['url']];
                } elseif (isset($image['url'])) {
                    $images[] = ['url' => $image['url']];
                } elseif (isset($image['b64_json'])) {
                    $images[] = ['b64_json' => $image['b64_json']];
                }
            }
        }

        // 如果没有 images 字段，尝试从 content 中提取 markdown 图片链接
        if (empty($images) && isset($responseData['choices'][0]['message']['content'])) {
            $content = $responseData['choices'][0]['message']['content'];
            if (preg_match_all('/!\[.*?\]\((.*?)\)/', $content, $matches)) {
                foreach ($matches[1] as $url) {
                    $images[] = ['url' => $url];
                }
            }
        }

        return $images;
    }

    /**
     * 将OpenRouter图片数据添加到OpenAI响应对象中（转换为URL格式）.
     */
    private function addImageDataToResponse(
        OpenAIFormatResponse $response,
        array $images,
        array $responseData,
        ImageGenerateRequest $imageGenerateRequest
    ): void {
        // 使用Redis锁确保并发安全
        $lockOwner = $this->lockResponse($response);
        try {
            $currentData = $response->getData();
            $currentUsage = $response->getUsage() ?? new ImageUsage();

            // 处理每张图片的水印并转换为URL格式
            foreach ($images as $image) {
                try {
                    if (isset($image['b64_json'])) {
                        // base64 格式：添加水印并转换为 URL
                        $processedUrl = $this->watermarkProcessor->addWatermarkToBase64($image['b64_json'], $imageGenerateRequest);
                        $currentData[] = ['url' => $processedUrl];
                    } elseif (isset($image['url'])) {
                        // URL 格式：下载、添加水印、上传并返回新 URL
                        $processedUrl = $this->watermarkProcessor->addWatermarkToUrl($image['url'], $imageGenerateRequest);
                        $currentData[] = ['url' => $processedUrl];
                    } else {
                        // 未知格式，保持原样
                        $this->logger->warning('OpenRouter：未知图片格式', ['image' => $image]);
                        $currentData[] = $image;
                    }
                } catch (Exception $e) {
                    $this->logger->error('OpenRouter添加图片数据：水印处理失败', [
                        'error' => $e->getMessage(),
                        'image' => $image,
                    ]);
                    // 水印处理失败时，如果原图是 URL 则保持原 URL
                    if (isset($image['url'])) {
                        $currentData[] = $image;
                    }
                }
            }

            // 累计usage信息 - 从响应中提取
            if (! empty($responseData['usage']) && is_array($responseData['usage'])) {
                $usageData = $responseData['usage'];
                $currentUsage->promptTokens += $usageData['prompt_tokens'] ?? 0;
                $currentUsage->completionTokens += $usageData['completion_tokens'] ?? 0;
                $currentUsage->totalTokens += $usageData['total_tokens'] ?? 0;
            }
            // 累计生成的图片数量
            $currentUsage->addGeneratedImages(count($images));

            // 更新响应对象
            $response->setData($currentData);
            $response->setUsage($currentUsage);
        } finally {
            // 确保锁一定会被释放
            $this->unlockResponse($response, $lockOwner);
        }
    }

    private function shouldRetry(Throwable $e, int $retryCount, int $maxRetries): bool
    {
        if ($retryCount >= $maxRetries) {
            return false;
        }

        if ($e instanceof ConnectException) {
            return true;
        }

        if ($e instanceof RequestException && $e->hasResponse()) {
            $statusCode = $e->getResponse()->getStatusCode();

            // No retry list
            if (in_array($statusCode, [400, 401, 402, 403, 404, 413])) {
                return false;
            }

            // 429 - Check for quota vs rate limit
            if ($statusCode === 429) {
                $body = (string) $e->getResponse()->getBody();
                if (stripos($body, 'quota') !== false || stripos($body, 'cap') !== false) {
                    return false;
                }
                return true;
            }

            // Retry list
            if (in_array($statusCode, [408, 500, 502, 503, 504])) {
                return true;
            }
        }

        return false;
    }
}
