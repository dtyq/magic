<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\AbstractImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageUsage;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\Util\Context\CoContext;
use Exception;
use GuzzleHttp\Client;
use Hyperf\Coroutine\Parallel;
use Hyperf\Engine\Coroutine;
use Hyperf\Retry\Annotation\Retry;

class GoogleGeminiModel extends AbstractImageGenerate
{
    protected GoogleGeminiAPI $api;

    public function __construct(array $serviceProviderConfig)
    {
        $apiUrl = $serviceProviderConfig['url'];

        if (empty($apiUrl)) {
            throw new Exception('Google Gemini API URL 配置缺失');
        }

        $this->api = new GoogleGeminiAPI($serviceProviderConfig['api_key'], $apiUrl);
    }

    public function generateImageRaw(ImageGenerateRequest $imageGenerateRequest): array
    {
        return $this->generateImageRawInternal($imageGenerateRequest);
    }

    public function setAK(string $ak)
    {
        // Google Gemini 不需要AK
    }

    public function setSK(string $sk)
    {
        // Google Gemini 不需要SK
    }

    public function setApiKey(string $apiKey)
    {
        $this->api->setAccessToken($apiKey);
    }

    public function generateImageRawWithWatermark(ImageGenerateRequest $imageGenerateRequest): array
    {
        $rawData = $this->generateImageRaw($imageGenerateRequest);
        return $this->processGoogleGeminiRawDataWithWatermark($rawData, $imageGenerateRequest);
    }

    /**
     * 生成图像并返回OpenAI格式响应 - Google Gemini版本.
     */
    public function generateImageOpenAIFormat(ImageGenerateRequest $imageGenerateRequest): OpenAIFormatResponse
    {
        // 1. 预先创建响应对象
        $response = new OpenAIFormatResponse([
            'created' => time(),
            'provider' => $this->getProviderName(),
            'data' => [],
        ]);

        // 2. 参数验证
        if (! $imageGenerateRequest instanceof GoogleGeminiRequest) {
            $this->logger->error('GoogleGemini OpenAI格式生图：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
            return $response; // 返回空数据响应
        }

        // 3. 并发处理 - 直接操作响应对象
        $count = $imageGenerateRequest->getGenerateNum();
        $parallel = new Parallel();
        $fromCoroutineId = Coroutine::id();

        for ($i = 0; $i < $count; ++$i) {
            $parallel->add(function () use ($imageGenerateRequest, $response, $fromCoroutineId) {
                CoContext::copy($fromCoroutineId);
                try {
                    $result = $this->requestImageGeneration($imageGenerateRequest);
                    $this->validateGoogleGeminiResponse($result);

                    // 成功：设置图片数据到响应对象
                    $this->addImageDataToResponseGemini($response, $result, $imageGenerateRequest);
                } catch (Exception $e) {
                    // 失败：设置错误信息到响应对象（只设置第一个错误）
                    if (! $response->hasError()) {
                        $response->setProviderErrorCode($e->getCode());
                        $response->setProviderErrorMessage($e->getMessage());
                    }

                    $this->logger->error('GoogleGemini OpenAI格式生图：单个请求失败', [
                        'error_code' => $e->getCode(),
                        'error_message' => $e->getMessage(),
                    ]);
                }
            });
        }

        $parallel->wait();

        // 4. 记录最终结果
        $this->logger->info('GoogleGemini OpenAI格式生图：并发处理完成', [
            '总请求数' => $count,
            '成功图片数' => count($response->getData()),
            '是否有错误' => $response->hasError(),
            '错误码' => $response->getProviderErrorCode(),
            '错误消息' => $response->getProviderErrorMessage(),
        ]);

        return $response;
    }

    public function getProviderName(): string
    {
        return 'google_gemini';
    }

    protected function generateImageInternal(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        $rawResults = $this->generateImageRawInternal($imageGenerateRequest);

        $imageData = [];
        foreach ($rawResults as $index => $result) {
            if (! empty($result['imageData'])) {
                $imageData[$index] = $result['imageData'];
            }
        }

        if (empty($imageData)) {
            $this->logger->error('Google Gemini文生图：所有图片生成均失败', ['rawResults' => $rawResults]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::NO_VALID_IMAGE);
        }

        ksort($imageData);
        $imageData = array_values($imageData);

        return new ImageGenerateResponse(ImageGenerateType::BASE_64, $imageData);
    }

    protected function getAlertPrefix(): string
    {
        return 'Google Gemini API';
    }

    protected function checkBalance(): float
    {
        // Google Gemini API 目前没有余额查询接口，返回默认值
        return 999.0;
    }

    #[Retry(
        maxAttempts: self::GENERATE_RETRY_COUNT,
        base: self::GENERATE_RETRY_TIME
    )]
    protected function requestImageGeneration(GoogleGeminiRequest $imageGenerateRequest): array
    {
        $prompt = $imageGenerateRequest->getPrompt();
        $modelId = $imageGenerateRequest->getModel();
        $referImages = $imageGenerateRequest->getReferImages();

        // 如果请求中指定了模型，则动态设置
        if (! empty($modelId)) {
            $this->api->setModelId($modelId);
        }

        try {
            // 如果有参考图像，则执行图像编辑
            if (! empty($referImages)) {
                // 取第一张参考图像进行编辑
                $referImage = $referImages[0];
                $result = $this->processImageEdit($referImage, $prompt);
            } else {
                $result = $this->api->generateImageFromText($prompt, [
                    'temperature' => $imageGenerateRequest->getTemperature(),
                    'candidateCount' => $imageGenerateRequest->getCandidateCount(),
                    'maxOutputTokens' => $imageGenerateRequest->getMaxOutputTokens(),
                ]);
            }

            return $result;
        } catch (Exception $e) {
            $this->logger->warning('Google Gemini图片生成：调用图片生成接口失败', ['error' => $e->getMessage()]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $e->getMessage());
        }
    }

    private function processImageEdit(string $referImageUrl, string $instructions): array
    {
        // 直接处理URL图像
        $imageBase64 = $this->downloadImageAsBase64($referImageUrl);
        $mimeType = $this->detectMimeTypeFromUrl($referImageUrl);

        return $this->api->editBase64Image($imageBase64, $mimeType, $instructions);
    }

    private function downloadImageAsBase64(string $url): string
    {
        try {
            $client = new Client(['timeout' => 30]);
            $response = $client->get($url);

            if ($response->getStatusCode() !== 200) {
                throw new Exception("无法下载图像，HTTP状态码: {$response->getStatusCode()}");
            }

            $imageContent = $response->getBody()->getContents();
            if (empty($imageContent)) {
                throw new Exception('下载的图像内容为空');
            }

            return base64_encode($imageContent);
        } catch (Exception $e) {
            $this->logger->error('Google Gemini图生图：图像下载失败', [
                'url' => $url,
                'error' => $e->getMessage(),
            ]);
            throw new Exception("下载图像失败: {$e->getMessage()}");
        }
    }

    private function detectMimeTypeFromUrl(string $url): string
    {
        $extension = strtolower(pathinfo(parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));

        return match ($extension) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            default => 'image/jpeg'
        };
    }

    private function generateImageRawInternal(ImageGenerateRequest $imageGenerateRequest): array
    {
        if (! $imageGenerateRequest instanceof GoogleGeminiRequest) {
            $this->logger->error('Google Gemini文生图：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }

        // Google Gemini API每次只能生成一张图，通过并发调用实现多图生成
        $count = $imageGenerateRequest->getGenerateNum();
        $rawResults = [];
        $errors = [];

        $parallel = new Parallel();
        $fromCoroutineId = Coroutine::id();

        for ($i = 0; $i < $count; ++$i) {
            $parallel->add(function () use ($imageGenerateRequest, $i, $fromCoroutineId) {
                CoContext::copy($fromCoroutineId);
                try {
                    $result = $this->requestImageGeneration($imageGenerateRequest);
                    $imageData = $this->extractImageDataFromResponse($result);

                    return [
                        'success' => true,
                        'data' => ['imageData' => $imageData],
                        'index' => $i,
                    ];
                } catch (Exception $e) {
                    $this->logger->error('Google Gemini文生图：图片生成失败', [
                        'error' => $e->getMessage(),
                        'index' => $i,
                    ]);
                    return [
                        'success' => false,
                        'error' => $e->getMessage(),
                        'index' => $i,
                    ];
                }
            });
        }

        $results = $parallel->wait();

        foreach ($results as $result) {
            if ($result['success']) {
                $rawResults[$result['index']] = $result['data'];
            } else {
                $errors[] = $result['error'] ?? '未知错误';
            }
        }

        if (empty($rawResults)) {
            $errorMessage = implode('; ', $errors);
            $this->logger->error('Google Gemini文生图：所有图片生成均失败', ['errors' => $errors]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::NO_VALID_IMAGE, $errorMessage);
        }

        ksort($rawResults);
        return array_values($rawResults);
    }

    private function extractImageDataFromResponse(array $result): string
    {
        if (! isset($result['candidates']) || ! is_array($result['candidates'])) {
            throw new Exception('响应中缺少candidates字段');
        }

        foreach ($result['candidates'] as $candidate) {
            if (! isset($candidate['content']['parts'])) {
                continue;
            }

            foreach ($candidate['content']['parts'] as $part) {
                if (isset($part['inlineData']['data'])) {
                    return $part['inlineData']['data'];
                }
            }
        }

        throw new Exception('响应中未找到图片数据');
    }

    private function processGoogleGeminiRawDataWithWatermark(array $rawData, ImageGenerateRequest $imageGenerateRequest): array
    {
        foreach ($rawData as $index => &$result) {
            if (! isset($result['imageData'])) {
                continue;
            }

            try {
                $result['imageData'] = $this->watermarkProcessor->addWatermarkToBase64($result['imageData'], $imageGenerateRequest);
            } catch (Exception $e) {
                $this->logger->error('Google Gemini图片水印处理失败', [
                    'index' => $index,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $rawData;
    }

    /**
     * 验证Google Gemini API响应数据格式.
     */
    private function validateGoogleGeminiResponse(array $result): void
    {
        if (! isset($result['candidates']) || ! is_array($result['candidates'])) {
            throw new Exception('Google Gemini响应数据格式错误：缺少candidates字段');
        }

        $hasValidImage = false;
        foreach ($result['candidates'] as $candidate) {
            if (isset($candidate['content']['parts']) && is_array($candidate['content']['parts'])) {
                foreach ($candidate['content']['parts'] as $part) {
                    if (isset($part['inlineData']['data']) && ! empty($part['inlineData']['data'])) {
                        $hasValidImage = true;
                        break 2;
                    }
                }
            }
        }

        if (! $hasValidImage) {
            throw new Exception('Google Gemini响应数据格式错误：缺少图像数据');
        }
    }

    /**
     * 将Google Gemini图片数据添加到OpenAI响应对象中（转换为URL格式）.
     */
    private function addImageDataToResponseGemini(
        OpenAIFormatResponse $response,
        array $geminiResult,
        ImageGenerateRequest $imageGenerateRequest
    ): void {
        // 使用Redis锁确保并发安全
        $lockOwner = $this->lockResponse($response);
        try {
            // 使用现有方法提取图像数据
            $imageBase64 = $this->extractImageDataFromResponse($geminiResult);

            $currentData = $response->getData();
            $currentUsage = $response->getUsage() ?? new ImageUsage();

            // 水印处理（会将base64转换为URL）
            $processedUrl = $imageBase64;
            try {
                $processedUrl = $this->watermarkProcessor->addWatermarkToBase64($imageBase64, $imageGenerateRequest);
            } catch (Exception $e) {
                $this->logger->error('GoogleGemini添加图片数据：水印处理失败', [
                    'error' => $e->getMessage(),
                ]);
                // 水印处理失败时使用原始base64数据（但这通常不应该发生）
            }

            // 只返回URL格式，与其他模型保持一致
            $currentData[] = [
                'url' => $processedUrl,
            ];

            // 累计usage信息 - 从usageMetadata中提取
            if (! empty($geminiResult['usageMetadata']) && is_array($geminiResult['usageMetadata'])) {
                $usageMetadata = $geminiResult['usageMetadata'];
                $currentUsage->addGeneratedImages(1);
                $currentUsage->promptTokens += $usageMetadata['promptTokenCount'] ?? 0;
                $currentUsage->completionTokens += $usageMetadata['candidatesTokenCount'] ?? 0;
                $currentUsage->totalTokens += $usageMetadata['totalTokenCount'] ?? 0;
            } else {
                // 如果没有usage信息，默认增加1张图片
                $currentUsage->addGeneratedImages(1);
            }

            // 更新响应对象
            $response->setData($currentData);
            $response->setUsage($currentUsage);
        } finally {
            // 确保锁一定会被释放
            $this->unlockResponse($response, $lockOwner);
        }
    }
}
