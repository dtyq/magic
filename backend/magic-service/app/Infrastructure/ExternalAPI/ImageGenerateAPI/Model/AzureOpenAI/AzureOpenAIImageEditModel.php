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
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use Exception;
use Hyperf\Retry\Annotation\Retry;

class AzureOpenAIImageEditModel extends AbstractImageGenerate
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
        if (! $imageGenerateRequest instanceof AzureOpenAIImageEditRequest) {
            $this->logger->error('Azure OpenAI图像编辑：请求类型错误', [
                'expected' => AzureOpenAIImageEditRequest::class,
                'actual' => get_class($imageGenerateRequest),
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }

        $this->validateRequest($imageGenerateRequest);

        $this->logger->info('Azure OpenAI图像编辑：开始调用API', [
            'reference_images_count' => count($imageGenerateRequest->getReferenceImages()),
            'has_mask' => ! empty($imageGenerateRequest->getMaskUrl()),
            'prompt' => $imageGenerateRequest->getPrompt(),
            'size' => $imageGenerateRequest->getSize(),
            'n' => $imageGenerateRequest->getN(),
        ]);

        try {
            return $this->api->editImage(
                $imageGenerateRequest->getReferenceImages(),
                $imageGenerateRequest->getMaskUrl(),
                $imageGenerateRequest->getPrompt(),
                $imageGenerateRequest->getSize(),
                $imageGenerateRequest->getN()
            );
        } catch (Exception $e) {
            $this->logger->error('Azure OpenAI图像编辑：API调用失败', [
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


        return $this->processAzureOpenAIEditRawDataWithWatermark($rawData, $imageGenerateRequest);
    }

    protected function generateImageInternal(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        try {
            $result = $this->generateImageRaw($imageGenerateRequest);
            $response = $this->buildResponse($result);

            $this->logger->info('Azure OpenAI图像编辑：图像生成成功', [
                'image_count' => count($response->getData()),
            ]);

            return $response;
        } catch (Exception $e) {
            $this->logger->error('Azure OpenAI图像编辑：图像生成失败', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    private function validateRequest(AzureOpenAIImageEditRequest $request): void
    {
        if (empty($request->getPrompt())) {
            $this->logger->error('Azure OpenAI图像编辑：缺少必要参数 - prompt');
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.prompt_required');
        }

        if (empty($request->getReferenceImages())) {
            $this->logger->error('Azure OpenAI图像编辑：缺少必要参数 - reference images');
            ExceptionBuilder::throw(ImageGenerateErrorCode::MISSING_IMAGE_DATA, 'image_generate.reference_images_required');
        }

        if ($request->getN() < 1 || $request->getN() > 10) {
            $this->logger->error('Azure OpenAI图像编辑：生成数量超出范围', [
                'requested' => $request->getN(),
                'valid_range' => '1-10',
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.invalid_image_count');
        }

        // 验证图像URL格式
        foreach ($request->getReferenceImages() as $index => $imageUrl) {
            if (empty($imageUrl) || ! filter_var($imageUrl, FILTER_VALIDATE_URL)) {
                $this->logger->error('Azure OpenAI图像编辑：无效的参考图像URL', [
                    'index' => $index,
                    'url' => $imageUrl,
                ]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.invalid_image_url');
            }
        }

        // 验证mask URL（如果提供）
        $maskUrl = $request->getMaskUrl();
        if (! empty($maskUrl) && ! filter_var($maskUrl, FILTER_VALIDATE_URL)) {
            $this->logger->error('Azure OpenAI图像编辑：无效的遮罩图像URL', [
                'mask_url' => $maskUrl,
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.invalid_mask_url');
        }
    }

    private function buildResponse(array $result): ImageGenerateResponse
    {
        try {
            if (! isset($result['data'])) {
                $this->logger->error('Azure OpenAI图像编辑：响应格式错误 - 缺少data字段', [
                    'response' => $result,
                ]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::RESPONSE_FORMAT_ERROR, 'image_generate.response_format_error');
            }

            if (empty($result['data'])) {
                $this->logger->error('Azure OpenAI图像编辑：响应数据为空', [
                    'response' => $result,
                ]);
                ExceptionBuilder::throw(ImageGenerateErrorCode::NO_VALID_IMAGE, 'image_generate.no_image_generated');
            }

            $images = [];
            foreach ($result['data'] as $index => $item) {
                if (! isset($item['b64_json'])) {
                    $this->logger->warning('Azure OpenAI图像编辑：跳过无效的图像数据', [
                        'index' => $index,
                        'item' => $item,
                    ]);
                    continue;
                }
                $images[] = $item['b64_json'];
            }

            if (empty($images)) {
                $this->logger->error('Azure OpenAI图像编辑：所有图像数据无效');
                ExceptionBuilder::throw(ImageGenerateErrorCode::MISSING_IMAGE_DATA, 'image_generate.invalid_image_data');
            }

            $this->logger->info('Azure OpenAI图像编辑：成功构建响应', [
                'total_images' => count($images),
            ]);

            return new ImageGenerateResponse(ImageGenerateType::BASE_64, $images);
        } catch (Exception $e) {
            $this->logger->error('Azure OpenAI图像编辑：构建响应失败', [
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
     * 为Azure OpenAI编辑模式原始数据添加水印.
     */
    private function processAzureOpenAIEditRawDataWithWatermark(array $rawData, ImageGenerateRequest $imageGenerateRequest): array
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
                $this->logger->error('Azure OpenAI图像编辑水印处理失败', [
                    'index' => $index,
                    'error' => $e->getMessage(),
                ]);
                // 继续处理下一张图片，当前图片保持原始状态
            }
        }

        return $rawData;
    }
}
