<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\AzureOpenAI;

use App\Domain\ModelAdmin\Entity\ValueObject\ServiceProviderConfig;
use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\AzureOpenAIImageEditRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\AzureOpenAIImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use Exception;
use Psr\Log\LoggerInterface;

class AzureOpenAIImageGenerateModel implements ImageGenerate
{
    protected LoggerInterface $logger;

    private AzureOpenAIAPI $api;

    private ServiceProviderConfig $config;

    public function __construct(ServiceProviderConfig $serviceProviderConfig)
    {
        $this->config = $serviceProviderConfig;
        $baseUrl = $this->config->getUrl();
        $apiVersion = $this->config->getApiVersion();
        $this->api = new AzureOpenAIAPI($this->config->getApiKey(), $baseUrl, $apiVersion);
        $this->logger = di(LoggerInterface::class);
    }

    public function generateImage(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        $this->logger->info('Azure OpenAI图像生成：开始生成图像', [
            'request_type' => get_class($imageGenerateRequest),
        ]);

        try {
            // 判断是否有参考图像
            if ($imageGenerateRequest instanceof AzureOpenAIImageGenerateRequest && ! empty($imageGenerateRequest->getReferenceImages())) {
                $this->logger->info('Azure OpenAI图像生成：检测到参考图像，使用图像编辑模式', [
                    'reference_images_count' => count($imageGenerateRequest->getReferenceImages()),
                ]);
                // 有参考图像，使用图像编辑模型
                return $this->generateImageWithReference($imageGenerateRequest);
            }

            // 无参考图像，使用原有的生成逻辑
            $result = $this->generateImageRaw($imageGenerateRequest);
            $response = $this->buildResponse($result);

            $this->logger->info('Azure OpenAI图像生成：图像生成成功', [
                'image_count' => count($response->getData()),
            ]);

            return $response;
        } catch (Exception $e) {
            $this->logger->error('Azure OpenAI图像生成：图像生成失败', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    public function generateImageRaw(ImageGenerateRequest $imageGenerateRequest): array
    {
        if (! $imageGenerateRequest instanceof AzureOpenAIImageGenerateRequest) {
            $this->logger->error('Azure OpenAI图像生成：请求类型错误', [
                'expected' => AzureOpenAIImageGenerateRequest::class,
                'actual' => get_class($imageGenerateRequest),
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR);
        }

        // 判断是否有参考图像
        if (! empty($imageGenerateRequest->getReferenceImages())) {
            $this->logger->info('Azure OpenAI图像生成：使用图像编辑模式处理参考图像', [
                'reference_images_count' => count($imageGenerateRequest->getReferenceImages()),
            ]);

            try {
                // 有参考图像，使用图像编辑模型
                $editModel = new AzureOpenAIImageEditModel($this->config);
                $editRequest = $this->convertToEditRequest($imageGenerateRequest);
                return $editModel->generateImageRaw($editRequest);
            } catch (Exception $e) {
                $this->logger->error('Azure OpenAI图像生成：图像编辑模式失败', [
                    'error' => $e->getMessage(),
                ]);
                throw $e;
            }
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
                'trace' => $e->getTraceAsString(),
            ]);
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.api_call_failed');
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
        $this->logger->info('Azure OpenAI图像生成：API密钥已更新');
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

            $this->logger->info('Azure OpenAI图像生成：成功构建响应', [
                'total_images' => count($images),
            ]);

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
        $this->logger->info('Azure OpenAI图像生成：开始使用参考图像生成', [
            'reference_images_count' => count($imageGenerateRequest->getReferenceImages()),
        ]);

        try {
            $editModel = new AzureOpenAIImageEditModel($this->config);
            $editRequest = $this->convertToEditRequest($imageGenerateRequest);
            $response = $editModel->generateImage($editRequest);

            $this->logger->info('Azure OpenAI图像生成：参考图像生成成功', [
                'image_count' => count($response->getData()),
            ]);

            return $response;
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
}
