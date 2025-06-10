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
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\ImageGenerateResponse;
use Exception;
use InvalidArgumentException;

class AzureOpenAIImageEditModel implements ImageGenerate
{
    private AzureOpenAIAPI $api;

    private ServiceProviderConfig $config;

    public function __construct(ServiceProviderConfig $serviceProviderConfig)
    {
        $this->config = $serviceProviderConfig;
        $baseUrl = $this->config->getUrl();
        $deploymentName = $this->config->getDeploymentName();
        $this->api = new AzureOpenAIAPI($this->config->getApiKey(), $baseUrl, $deploymentName);
    }

    public function generateImage(ImageGenerateRequest $imageGenerateRequest): ImageGenerateResponse
    {
        $result = $this->generateImageRaw($imageGenerateRequest);
        return $this->buildResponse($result);
    }

    public function generateImageRaw(ImageGenerateRequest $imageGenerateRequest): array
    {
        if (! $imageGenerateRequest instanceof AzureOpenAIImageEditRequest) {
            throw new InvalidArgumentException('Request must be AzureOpenAIImageEditRequest');
        }

        return $this->api->editImage(
            $imageGenerateRequest->getImageUrls(),
            $imageGenerateRequest->getMaskUrl(),
            $imageGenerateRequest->getPrompt(),
            $imageGenerateRequest->getSize(),
            $imageGenerateRequest->getN()
        );
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
        $deploymentName = $this->config->getDeploymentName();
        $this->api = new AzureOpenAIAPI($apiKey, $baseUrl, $deploymentName);
    }

    private function buildResponse(array $result): ImageGenerateResponse
    {
        if (isset($result['data']) && ! empty($result['data'])) {
            $images = [];
            foreach ($result['data'] as $item) {
                if (isset($item['b64_json'])) {
                    // Convert base64 to data URL format
                    $images[] = $item['b64_json'];
                }
            }
            return new ImageGenerateResponse(ImageGenerateType::BASE_64, $images);
        }
        throw new Exception('No image data received from Azure OpenAI');
    }
}
