<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\AzureOpenAI;

use App\Domain\ModelAdmin\Entity\ValueObject\ServiceProviderConfig;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerate;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\AzureOpenAIImageEditRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\AzureOpenAIImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use Exception;
use InvalidArgumentException;

class AzureOpenAIImageGenerateModel implements ImageGenerate
{
    private AzureOpenAIAPI $api;

    private ServiceProviderConfig $config;

    public function __construct(ServiceProviderConfig $serviceProviderConfig)
    {
        $this->config = $serviceProviderConfig;
        $baseUrl = $this->config->getUrl();
        $apiVersion = $this->config->getApiVersion();
        $this->api = new AzureOpenAIAPI($this->config->getApiKey(), $baseUrl, $apiVersion);
    }

    public function generateImage(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        // 判断是否有参考图像
        if ($imageGenerateRequest instanceof AzureOpenAIImageGenerateRequest && ! empty($imageGenerateRequest->getReferenceImages())) {
            // 有参考图像，使用图像编辑模型
            return $this->generateImageWithReference($imageGenerateRequest);
        }

        // 无参考图像，使用原有的生成逻辑
        $result = $this->generateImageRaw($imageGenerateRequest);
        return $this->buildResponse($result);
    }

    public function generateImageRaw(ImageGenerateRequest $imageGenerateRequest): array
    {
        if (! $imageGenerateRequest instanceof AzureOpenAIImageGenerateRequest) {
            throw new InvalidArgumentException('Request must be AzureOpenAIImageGenerateRequest');
        }

        // 判断是否有参考图像
        if (! empty($imageGenerateRequest->getReferenceImages())) {
            // 有参考图像，使用图像编辑模型
            $editModel = new AzureOpenAIImageEditModel($this->config);
            $editRequest = $this->convertToEditRequest($imageGenerateRequest);
            return $editModel->generateImageRaw($editRequest);
        }

        // 无参考图像，使用原有的生成逻辑
        $requestData = [
            'prompt' => $imageGenerateRequest->getPrompt(),
            'size' => $imageGenerateRequest->getSize(),
            'quality' => $imageGenerateRequest->getQuality(),
            'n' => $imageGenerateRequest->getN(),
        ];

        return $this->api->generateImage($requestData);
    }

    public function setAK(string $ak): void
    {
        // Not used for Azure OpenAI
    }

    public function setSK(string $sk): void
    {
        // Not used for Azure OpenAI
    }

    public function setApiKey(string $apiKey): void
    {
        $baseUrl = $this->config->getUrl();
        $apiVersion = $this->config->getApiVersion();
        $this->api = new AzureOpenAIAPI($apiKey, $baseUrl, $apiVersion);
    }

    private function buildResponse(array $result): ImageGenerateResponse
    {
        if (isset($result['data']) && ! empty($result['data'])) {
            return new ImageGenerateResponse(ImageGenerateType::BASE_64, $result = array_column($result['data'], 'b64_json'));
        }
        throw new Exception('No image data received from Azure OpenAI');
    }

    /**
     * 当有参考图像时，使用图像编辑模型生成图像.
     */
    private function generateImageWithReference(AzureOpenAIImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        $editModel = new AzureOpenAIImageEditModel($this->config);
        $editRequest = $this->convertToEditRequest($imageGenerateRequest);
        return $editModel->generateImage($editRequest);
    }

    /**
     * 将图像生成请求转换为图像编辑请求
     */
    private function convertToEditRequest(AzureOpenAIImageGenerateRequest $imageGenerateRequest): AzureOpenAIImageEditRequest
    {
        $editRequest = new AzureOpenAIImageEditRequest();
        $editRequest->setPrompt($imageGenerateRequest->getPrompt());
        $editRequest->setReferenceImages($imageGenerateRequest->getReferenceImages());
        $editRequest->setSize($imageGenerateRequest->getSize());
        $editRequest->setN($imageGenerateRequest->getN());
        // 图像编辑不需要mask，所以设置为null
        $editRequest->setMaskUrl(null);

        return $editRequest;
    }
}
