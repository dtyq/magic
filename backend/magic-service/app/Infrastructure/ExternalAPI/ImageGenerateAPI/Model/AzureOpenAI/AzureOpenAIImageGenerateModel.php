<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\AzureOpenAI;

use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\AbstractImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\AzureOpenAIImageEditRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\AzureOpenAIImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use Exception;
use Hyperf\Retry\Annotation\Retry;

class AzureOpenAIImageGenerateModel extends AbstractImageGenerate
{
    private AzureOpenAIAPI $api;

    private ProviderConfigItem $config;

    public function __construct(ProviderConfigItem $serviceProviderConfig)
    {
        $this->config = $serviceProviderConfig;
        $baseUrl = $this->config->getUrl();
        $apiVersion = $this->config->getApiVersion();
        $this->api = new AzureOpenAIAPI($this->config->getApiKey(), $baseUrl, $apiVersion);
    }

    #[Retry(
        maxAttempts: self::GENERATE_RETRY_COUNT,
        base: self::GENERATE_RETRY_TIME
    )]
    public function generateImageRaw(ImageGenerateRequest $imageGenerateRequest): array
    {
        if (! $imageGenerateRequest instanceof AzureOpenAIImageGenerateRequest) {
            $this->logger->error('Azure OpenAI图像生成：请求类型错误', [
                'expected' => AzureOpenAIImageGenerateRequest::class,
                'actual' => get_class($imageGenerateRequest),
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }

        $this->validateRequest($imageGenerateRequest);

        // 无参考图像，使用原有的生成逻辑
        $this->logger->info('Azure OpenAI图像生成：开始调用生成API', [
            'prompt' => $imageGenerateRequest->getPrompt(),
            'size' => $imageGenerateRequest->getSize(),
            'quality' => $imageGenerateRequest->getQuality(),
            'n' => $imageGenerateRequest->getN(),
        ]);

        try {
            $requestData = [
                'prompt' => $imageGenerateRequest->getPrompt(),
                'size' => $imageGenerateRequest->getSize(),
                'quality' => $imageGenerateRequest->getQuality(),
                'n' => $imageGenerateRequest->getN(),
            ];

            $result = $this->api->generateImage($requestData);

            $this->logger->info('Azure OpenAI图像生成：API调用成功', [
                'result_data_count' => isset($result['data']) ? count($result['data']) : 0,
            ]);

            return $result;
        } catch (Exception $e) {
            $this->logger->error('Azure OpenAI图像生成：API调用失败', [
                'error' => $e->getMessage(),
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }
    }

    public function setAK(string $ak): void
    {
    }

    public function setSK(string $sk): void
    {
    }

    public function setApiKey(string $apiKey): void
    {
        $baseUrl = $this->config->getUrl();
        $apiVersion = $this->config->getApiVersion();
        $this->api = new AzureOpenAIAPI($apiKey, $baseUrl, $apiVersion);
    }

    public function generateImageRawWithWatermark(ImageGenerateRequest $imageGenerateRequest): array
    {
        $rawData = $this->generateImageRaw($imageGenerateRequest);

        return $this->processAzureOpenAIRawDataWithWatermark($rawData, $imageGenerateRequest);
    }

    protected function generateImageInternal(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        try {
            if ($imageGenerateRequest instanceof AzureOpenAIImageGenerateRequest && ! empty($imageGenerateRequest->getReferenceImages())) {
                return $this->generateImageWithReference($imageGenerateRequest);
            }

            $result = $this->generateImageRaw($imageGenerateRequest);
            return $this->buildResponse($result);
        } catch (Exception $e) {
            $this->logger->error('Azure OpenAI图像生成：图像生成失败', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    private function buildResponse(array $result): ImageGenerateResponse
    {
        try {
            if (! isset($result['data'])) {
                $this->logger->error('Azure OpenAI图像生成：响应格式错误 - 缺少data字段', [
                    'response' => $result,
                ]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::RESPONSE_FORMAT_ERROR, 'image_generate.response_format_error');
            }

            if (empty($result['data'])) {
                $this->logger->error('Azure OpenAI图像生成：响应数据为空', [
                    'response' => $result,
                ]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::NO_VALID_IMAGE, 'image_generate.no_image_generated');
            }

            $images = array_column($result['data'], 'b64_json');

            if (empty($images)) {
                $this->logger->error('Azure OpenAI图像生成：所有图像数据无效');
                ExceptionBuilder::throw(ImageGenerateErrorCode::MISSING_IMAGE_DATA, 'image_generate.invalid_image_data');
            }

            // 过滤掉空值
            $images = array_filter($images);

            if (empty($images)) {
                $this->logger->error('Azure OpenAI图像生成：过滤后无有效图像数据');
                ExceptionBuilder::throw(ImageGenerateErrorCode::MISSING_IMAGE_DATA, 'image_generate.no_valid_image_data');
            }

            return new ImageGenerateResponse(ImageGenerateType::BASE_64, $images);
        } catch (Exception $e) {
            $this->logger->error('Azure OpenAI图像生成：构建响应失败', [
                'error' => $e->getMessage(),
                'result' => $result,
            ]);

            if ($e instanceof BusinessException) {
                throw $e;
            }

            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.response_build_failed');
        }
    }

    /**
     * 当有参考图像时，使用图像编辑模型生成图像.
     */
    private function generateImageWithReference(AzureOpenAIImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        try {
            $editModel = new AzureOpenAIImageEditModel($this->config);
            $editRequest = $this->convertToEditRequest($imageGenerateRequest);
            return $editModel->generateImage($editRequest);
        } catch (Exception $e) {
            $this->logger->error('Azure OpenAI图像生成：参考图像生成失败', [
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * 将图像生成请求转换为图像编辑请求
     */
    private function convertToEditRequest(AzureOpenAIImageGenerateRequest $imageGenerateRequest): AzureOpenAIImageEditRequest
    {
        try {
            $editRequest = new AzureOpenAIImageEditRequest();
            $editRequest->setPrompt($imageGenerateRequest->getPrompt());
            $editRequest->setReferenceImages($imageGenerateRequest->getReferenceImages());
            $editRequest->setSize($imageGenerateRequest->getSize());
            $editRequest->setN($imageGenerateRequest->getN());
            // 图像编辑不需要mask，所以设置为null
            $editRequest->setMaskUrl(null);

            return $editRequest;
        } catch (Exception $e) {
            $this->logger->error('Azure OpenAI图像生成：请求格式转换失败', [
                'error' => $e->getMessage(),
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.request_conversion_failed');
        }
    }

    private function validateRequest(AzureOpenAIImageGenerateRequest $request): void
    {
        if (empty($request->getPrompt())) {
            $this->logger->error('Azure OpenAI图像生成：缺少必要参数 - prompt');
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.prompt_required');
        }

        if ($request->getN() < 1 || $request->getN() > 10) {
            $this->logger->error('Azure OpenAI图像生成：生成数量超出范围', [
                'requested' => $request->getN(),
                'valid_range' => '1-10',
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.invalid_image_count');
        }
    }

    /**
     * 为Azure OpenAI原始数据添加水印.
     */
    private function processAzureOpenAIRawDataWithWatermark(array $rawData, ImageGenerateRequest $imageGenerateRequest): array
    {
        if (! isset($rawData['data']) || ! is_array($rawData['data'])) {
            return $rawData;
        }

        foreach ($rawData['data'] as $index => &$item) {
            if (! isset($item['b64_json'])) {
                continue;
            }

            try {
                // 处理base64格式的图片
                $item['b64_json'] = $this->watermarkProcessor->addWatermarkToBase64($item['b64_json'], $imageGenerateRequest);
            } catch (Exception $e) {
                // 水印处理失败时，记录错误但不影响图片返回
                $this->logger->error('Azure OpenAI图片水印处理失败', [
                    'index' => $index,
                    'error' => $e->getMessage(),
                ]);
                // 继续处理下一张图片，当前图片保持原始状态
            }
        }

        return $rawData;
    }
}
