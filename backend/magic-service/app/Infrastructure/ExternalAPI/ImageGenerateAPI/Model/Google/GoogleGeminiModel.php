<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google;

use App\Domain\Provider\DTO\Item\GoogleProviderConfigItem;
use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\AbstractImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Google\Client\GoogleGeminiInterface;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageUsage;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\Util\File\ImageBase64DataUriParser;
use Exception;
use Hyperf\Retry\Annotation\Retry;
use Throwable;

class GoogleGeminiModel extends AbstractImageGenerate
{
    /** Google Gemini 生图接口客户端。 */
    protected GoogleGeminiInterface $api;

    /** Google 生图参考图传输策略。 */
    protected string $referenceImageTransport;

    /** Google 生图参考图 Base64 准备器。 */
    protected GoogleReferenceImagePreparer $referenceImagePreparer;

    public function __construct(array $serviceProviderConfig)
    {
        $proxyUrl = $serviceProviderConfig['proxy_url'] ?? null;

        $this->api = GoogleGeminiFactory::create($serviceProviderConfig, $serviceProviderConfig['model_version'], $proxyUrl);

        $this->referenceImageTransport = GoogleProviderConfigItem::normalizeReferenceImageTransport(
            $serviceProviderConfig['reference_image_transport'] ?? null
        );

        $this->referenceImagePreparer = new GoogleReferenceImagePreparer();
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
        // Google Gemini 不需要SK
    }

    public function generateImageRawWithWatermark(ImageGenerateRequest $imageGenerateRequest): array
    {
        $rawData = $this->generateImageRaw($imageGenerateRequest);
        return $this->processGoogleGeminiRawDataWithWatermark($rawData, $imageGenerateRequest);
    }

    /**
     * 生成一张图片并转换为 OpenAI 响应格式。
     */
    public function generateImageOpenAIFormat(ImageGenerateRequest $imageGenerateRequest): OpenAIFormatResponse
    {
        $response = new OpenAIFormatResponse([
            'created' => time(),
            'provider' => $this->getProviderName(),
            'data' => [],
        ]);

        if (! $imageGenerateRequest instanceof GoogleGeminiRequest) {
            $this->logger->error('GoogleGemini OpenAI格式生图：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
            return $response;
        }

        $originalReferImages = $imageGenerateRequest->getReferImages();

        $result = $this->requestImageGenerationWithFallback($imageGenerateRequest, $originalReferImages);
        $this->addImageDataToResponseGemini($response, $result, $imageGenerateRequest);

        $this->logger->info('GoogleGemini OpenAI格式生图：处理完成', [
            '总请求数' => 1,
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
        $imageData = $rawResults[0]['imageData'] ?? '';
        if ($imageData === '') {
            $this->logger->error('Google Gemini文生图：所有图片生成均失败', ['rawResults' => $rawResults]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::NO_VALID_IMAGE);
        }

        return new ImageGenerateResponse(ImageGenerateType::BASE_64, [$imageData]);
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
        return $this->requestImageGenerationOnce($imageGenerateRequest);
    }

    /** 执行一次 Google 生图请求，不包含重试。 */
    private function requestImageGenerationOnce(GoogleGeminiRequest $imageGenerateRequest): array
    {
        $prompt = $imageGenerateRequest->getPrompt();
        $modelId = $imageGenerateRequest->getModel();
        $referImages = array_slice($imageGenerateRequest->getReferImages(), 0, 14);

        // 如果请求中指定了模型，则动态设置
        if (! empty($modelId)) {
            $this->api->setModelId($modelId);
        }

        // 构建 API 配置
        $config = $imageGenerateRequest->getGenerationConfig();

        try {
            if (! empty($referImages)) {
                return $this->generateWithReferenceImages($referImages, $prompt, $config);
            }

            return $this->api->generateContent($prompt, [], $config);
        } catch (Exception $e) {
            $this->logger->warning('Google Gemini图片生成：调用图片生成接口失败', ['error' => $e->getMessage(), 'TraceAsString' => $e->getTraceAsString()]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, throwable: $e);
        }
    }

    /**
     * 使用参考图生成图片，最多处理 14 张参考图。
     *
     * @param array $referImageUrls 参考图像URL数组
     * @param string $instructions 编辑指令
     * @param array $config 生成配置
     * @return array API响应结果
     */
    private function generateWithReferenceImages(array $referImageUrls, string $instructions, array $config = []): array
    {
        $imageParts = array_map(
            fn (array|string $image): array => $this->buildGoogleImagePart($image),
            array_slice($referImageUrls, 0, 14),
        );

        return $this->api->generateContent($instructions, $imageParts, $config);
    }

    /**
     * 将原始图片地址或已准备的 Base64 数据转换为 Gemini 请求结构。
     *
     * @param array{type: 'base64', mimeType: string, data: string}|string $image
     */
    private function buildGoogleImagePart(array|string $image): array
    {
        if (is_array($image)) {
            return $image;
        }

        $base64Image = ImageBase64DataUriParser::parseDecoded($image);
        if ($base64Image !== null) {
            return [
                'type' => 'base64',
                'mimeType' => $base64Image['mime_type'],
                'data' => $base64Image['base64_data'],
            ];
        }

        return [
            'type' => 'fileData',
            'fileUri' => $image,
            'mimeType' => $this->resolveImageMimeType($image),
        ];
    }

    private function resolveImageMimeType(string $url): string
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

    /**
     * Base64 模式在生成请求前只准备一次，避免同一批图片重复下载。
     */
    private function prepareBase64ReferenceImages(GoogleGeminiRequest $request): void
    {
        $request->setReferImages($this->referenceImagePreparer->prepare($request->getReferImages()));
    }

    /** 参考图首次请求失败时，按配置切换传输方式重试一次。 */
    private function requestImageGenerationWithFallback(GoogleGeminiRequest $request, array $originalReferImages): array
    {
        // 无参考图时无需切换传输方式，沿用原有重试机制。
        if (empty($originalReferImages)) {
            return $this->requestImageGeneration($request);
        }

        // URL 模式直接传递原始图片链接，并沿用原有重试机制。
        if ($this->referenceImageTransport === GoogleProviderConfigItem::REFERENCE_IMAGE_TRANSPORT_URL) {
            return $this->requestImageGeneration($request);
        }

        // Base64 模式先准备图片内容，再沿用原有重试机制。
        if ($this->referenceImageTransport === GoogleProviderConfigItem::REFERENCE_IMAGE_TRANSPORT_BASE64) {
            $this->prepareBase64ReferenceImages($request);
            return $this->requestImageGeneration($request);
        }

        // Base64 优先模式失败后恢复原始 URL，只额外请求一次。
        if ($this->referenceImageTransport === GoogleProviderConfigItem::REFERENCE_IMAGE_TRANSPORT_BASE64_FALLBACK_URL) {
            try {
                $this->prepareBase64ReferenceImages($request);
                return $this->requestImageGenerationOnce($request);
            } catch (Exception $e) {
                $this->logger->warning('Google Gemini 生图：Base64 传输失败，改用 URL 重试', [
                    'error' => $e->getMessage(),
                ]);
                $request->setReferImages($originalReferImages);
                return $this->requestImageGenerationOnce($request);
            }
        }

        // 默认使用 URL 优先模式，失败后转换为 Base64，只额外请求一次。
        try {
            return $this->requestImageGenerationOnce($request);
        } catch (Exception $e) {
            $this->logger->warning('Google Gemini 生图：URL 传输失败，改用 Base64 重试', [
                'error' => $e->getMessage(),
            ]);
            $request->setReferImages($this->referenceImagePreparer->prepare($originalReferImages));
            return $this->requestImageGenerationOnce($request);
        }
    }

    private function generateImageRawInternal(ImageGenerateRequest $imageGenerateRequest): array
    {
        if (! $imageGenerateRequest instanceof GoogleGeminiRequest) {
            $this->logger->error('Google Gemini文生图：无效的请求类型', ['class' => get_class($imageGenerateRequest)]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }

        $originalReferImages = $imageGenerateRequest->getReferImages();
        try {
            $result = $this->requestImageGenerationWithFallback($imageGenerateRequest, $originalReferImages);
            return [['imageData' => $this->extractImageDataFromResponse($result)]];
        } catch (Exception $e) {
            $this->logger->error('Google Gemini文生图：图片生成失败', ['error' => $e->getMessage()]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, throwable: $e);
        } finally {
            $imageGenerateRequest->setReferImages($originalReferImages);
        }
    }

    private function extractImageDataFromResponse(array $result): string
    {
        $candidates = $result['candidates'] ?? [];
        if (! is_array($candidates)) {
            $candidates = [];
        }

        foreach ($candidates as $candidateIndex => $candidate) {
            if (! isset($candidate['content']['parts'])) {
                continue;
            }

            foreach ($candidate['content']['parts'] as $partIndex => $part) {
                if (($part['thought'] ?? false) === true) {
                    $this->logSkippedThoughtImagePart($candidateIndex, $partIndex, 'extract_image');
                    continue;
                }
                if (isset($part['inlineData']['data'])) {
                    return $part['inlineData']['data'];
                }
            }
        }

        $finishReason = null;
        foreach ($candidates as $candidate) {
            if (is_array($candidate) && isset($candidate['finishReason'])) {
                $finishReason = $candidate['finishReason'];
                break;
            }
        }

        $errorCode = match ($finishReason) {
            'IMAGE_SAFETY', 'IMAGE_PROHIBITED_CONTENT' => ImageGenerateErrorCode::OUTPUT_IMAGE_AUDIT_FAILED,
            default => ImageGenerateErrorCode::GENERAL_ERROR,
        };

        ExceptionBuilder::throw(
            $errorCode,
            throwable: new Exception(
                json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR)
                    ?: 'Invalid Google Gemini response.'
            )
        );
    }

    private function logSkippedThoughtImagePart(int|string $candidateIndex, int|string $partIndex, string $stage): void
    {
        try {
            $this->logger->info('Google Gemini响应：检测到思考图，已过滤', [
                'stage' => $stage,
                'candidate_index' => $candidateIndex,
                'part_index' => $partIndex,
            ]);
        } catch (Throwable) {
            // Diagnostic logging must never affect image extraction.
        }
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
     * 将Google Gemini图片数据添加到OpenAI响应对象中（转换为URL格式）.
     */
    private function addImageDataToResponseGemini(
        OpenAIFormatResponse $response,
        array $geminiResult,
        ImageGenerateRequest $imageGenerateRequest
    ): void {
        $usage = $response->getUsage() ?? new ImageUsage();
        if (! empty($geminiResult['usageMetadata']) && is_array($geminiResult['usageMetadata'])) {
            $tokenUsage = $this->extractTokenUsage($geminiResult['usageMetadata']);
            $usage->addTokenUsage(
                $tokenUsage['prompt_tokens'],
                $tokenUsage['completion_tokens'],
                $tokenUsage['thoughts_tokens'],
                $tokenUsage['total_tokens']
            );
        }
        $response->setUsage($usage);

        $imageBase64 = $this->extractImageDataFromResponse($geminiResult);

        // 水印处理会将 Base64 图片转为 URL。
        $processedUrl = $imageBase64;
        try {
            $processedUrl = $this->watermarkProcessor->addWatermarkToBase64($imageBase64, $imageGenerateRequest);
        } catch (Exception $e) {
            $this->logger->error('GoogleGemini添加图片数据：水印处理失败', [
                'error' => $e->getMessage(),
            ]);
        }

        $data = $response->getData();
        $data[] = ['url' => $processedUrl];
        $response->setData($data);

        $usage->addGeneratedImages(1);
    }

    /**
     * @return array{prompt_tokens: int, completion_tokens: int, thoughts_tokens: int, total_tokens: int}
     */
    private function extractTokenUsage(array $usageMetadata): array
    {
        $candidateDetails = $usageMetadata['candidatesTokensDetails'] ?? [];
        $completionTokens = (int) ($usageMetadata['candidatesTokenCount'] ?? 0);
        if (is_array($candidateDetails) && $candidateDetails !== []) {
            $completionTokens = 0;
            foreach ($candidateDetails as $detail) {
                if (is_array($detail) && ($detail['modality'] ?? '') === 'IMAGE') {
                    $completionTokens += max(0, (int) ($detail['tokenCount'] ?? 0));
                }
            }
        }
        if ($completionTokens <= 0) {
            $completionTokens = (int) ($usageMetadata['candidatesTokenCount'] ?? 0);
        }

        return [
            'prompt_tokens' => (int) ($usageMetadata['promptTokenCount'] ?? 0),
            'completion_tokens' => $completionTokens,
            'thoughts_tokens' => (int) ($usageMetadata['thoughtsTokenCount'] ?? 0),
            'total_tokens' => (int) ($usageMetadata['totalTokenCount'] ?? 0),
        ];
    }
}
