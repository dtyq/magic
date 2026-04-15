<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Domain\Provider\DTO\Factory\ProviderConfigFactory;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\NaturalLanguageProcessing;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ConnectivityTest\ConnectResponse;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateFactory;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\ImageGenerateRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\ExternalAPI\Proxy\ProxyConfigResolverInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\DTO\ConnectivityTestByConfigRequest;
use Hyperf\Odin\Api\Request\ChatCompletionRequest;
use Hyperf\Odin\Contract\Model\EmbeddingInterface;
use Hyperf\Odin\Contract\Model\ModelInterface;
use Hyperf\Odin\Factory\ModelFactory;
use Hyperf\Odin\Model\ModelOptions;
use Hyperf\Odin\Utils\MessageUtil;
use Throwable;

use function Hyperf\Translation\__;

class LLMTestAppService extends AbstractLLMAppService
{
    /**
     * 按配置进行连通性测试（不依赖已保存的 model_id）.
     */
    public function connectivityTestByConfig(
        ConnectivityTestByConfigRequest $request,
        MagicUserAuthorization $authorization
    ): ConnectResponse {
        $providerCode = $request->getProviderCode();
        $modelVersion = $request->getModelVersion();
        $serviceProviderConfigId = $request->getServiceProviderConfigId();
        $serviceProviderConfig = $request->getServiceProviderConfig();
        $modelType = $request->getModelType();
        $category = Category::tryFrom($request->getCategory() ?? '');

        if ($serviceProviderConfigId !== '') {
            $serviceProviderConfigEntity = $this->serviceProviderDomainService->getServiceProviderConfigDetail($serviceProviderConfigId, $authorization->getOrganizationCode());
            $category = $serviceProviderConfigEntity->getCategory();
            $serviceProviderConfig = $serviceProviderConfigEntity->getConfig()?->toArray() ?? [];
            $providerCode = $serviceProviderConfigEntity->getProviderCode()->value;
        }

        // 过滤掉前后空字符串
        foreach ($serviceProviderConfig as $configIndex => $configValue) {
            if (is_string($configValue)) {
                $serviceProviderConfig[$configIndex] = trim($configValue);
            }
        }

        if ($category) {
            return match ($this->getConnectivityTestType($category->value, $modelType)) {
                NaturalLanguageProcessing::EMBEDDING => $this->embeddingConnectivityTestByConfig(
                    $providerCode,
                    $modelVersion,
                    $serviceProviderConfig,
                    $authorization,
                    $serviceProviderConfigId
                ),
                NaturalLanguageProcessing::LLM => $this->llmConnectivityTestByConfig(
                    $providerCode,
                    $modelVersion,
                    $serviceProviderConfig,
                    $authorization
                ),
                NaturalLanguageProcessing::VLM => $this->vlmConnectivityTestByConfig(
                    $providerCode,
                    $modelVersion,
                    $serviceProviderConfig,
                    $authorization,
                    $modelType
                ),
                NaturalLanguageProcessing::DEFAULT => throw new BusinessException(__('service_provider.model_not_found')),
            };
        }

        ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
    }

    /**
     * 获取联通测试类型.
     */
    private function getConnectivityTestType(string $category, ?int $modelType = null): NaturalLanguageProcessing
    {
        if ($category === Category::LLM->value) {
            return $modelType === ModelType::EMBEDDING->value ? NaturalLanguageProcessing::EMBEDDING : NaturalLanguageProcessing::LLM;
        }
        if ($category === Category::VLM->value) {
            return NaturalLanguageProcessing::VLM;
        }
        return NaturalLanguageProcessing::DEFAULT;
    }

    /**
     * VLM 连通性测试（按服务商配置ID读取配置，不依赖已保存模型ID）.
     */
    private function vlmConnectivityTestByConfig(
        string $providerCode,
        string $modelVersion,
        array $serviceProviderConfig,
        MagicUserAuthorization $authorization,
        ?int $modelType = null,
    ): ConnectResponse {
        $connectResponse = new ConnectResponse();

        if ($modelVersion === '') {
            $connectResponse->setStatus(false);
            $connectResponse->setMessage('model_version is empty');
            return $connectResponse;
        }

        try {
            $providerCodeEnum = ProviderCode::from($providerCode);
            $imageGenerateType = ImageGenerateModelType::fromProviderCode($providerCodeEnum, $modelVersion);

            if (empty($serviceProviderConfig['model_version'])) {
                $serviceProviderConfig['model_version'] = $modelVersion;
            }

            $requestData = [
                'model' => $modelVersion,
                'user_prompt' => __('service_provider.connectivity_test_prompt'),
                'negative_prompt' => '',
                'generate_num' => 1,
                'size' => '1:1',
                'reference_images' => [],
                'organization_code' => $authorization->getOrganizationCode(),
                'use_sr' => false,
            ];

            if ($modelType && ModelType::tryFrom($modelType)->isImageToImage()) {
                //                $requestData['reference_images'] = ['https://cdn.pixabay.com/photo/2017/02/20/18/03/cat-2083492_1280.jpg'];
            }

            $imageGenerateRequest = ImageGenerateFactory::createRequestType(
                $imageGenerateType,
                $modelVersion,
                null,
                $requestData
            );

            $response = $this->generateImageOpenAIFormatByConfig(
                $imageGenerateType,
                $serviceProviderConfig,
                $imageGenerateRequest
            );
            $connectResponse->setStatus(! $response->getProviderErrorMessage());
            $connectResponse->setMessage($response->getProviderErrorMessage());
        } catch (Throwable $exception) {
            $connectResponse->setStatus(false);
            $connectResponse->setMessage($exception->getMessage());
        }

        return $connectResponse;
    }

    private function embeddingConnectivityTestByConfig(
        string $providerCode,
        string $modelVersion,
        array $serviceProviderConfig,
        MagicUserAuthorization $authorization,
        string $serviceProviderConfigId = ''
    ): ConnectResponse {
        $connectResponse = new ConnectResponse();
        $supportMultiModal = $this->resolveEmbeddingSupportMultiModal(
            $authorization->getOrganizationCode(),
            $serviceProviderConfigId,
            $modelVersion
        );

        try {
            $model = $this->createConnectivityModelByConfig(
                $providerCode,
                $serviceProviderConfig,
                $modelVersion,
                true,
                $supportMultiModal
            );

            if (! $model instanceof EmbeddingInterface) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidModelType);
            }

            $model->embeddings(
                input: 'test',
                user: 'connectivity_test',
                businessParams: $this->buildConnectivityBusinessParams($authorization)
            );
            $connectResponse->setStatus(true);
        } catch (Throwable $exception) {
            $connectResponse->setStatus(false);
            $connectResponse->setMessage($exception->getMessage());
        }

        return $connectResponse;
    }

    private function llmConnectivityTestByConfig(
        string $providerCode,
        string $modelVersion,
        array $serviceProviderConfig,
        MagicUserAuthorization $authorization
    ): ConnectResponse {
        $connectResponse = new ConnectResponse();

        try {
            $model = $this->createConnectivityModelByConfig(
                $providerCode,
                $serviceProviderConfig,
                $modelVersion,
                false
            );

            if (! $model instanceof ModelInterface) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidModelType);
            }

            $message = MessageUtil::createFromArray(['role' => 'user', 'content' => '你好']);
            $chatRequest = new ChatCompletionRequest(
                messages: $message ? [$message] : [],
                temperature: 0.7,
                maxTokens: 16,
                stop: [],
                tools: []
            );
            $chatRequest->setBusinessParams($this->buildConnectivityBusinessParams($authorization));
            $model->chatWithRequest($chatRequest);
            $connectResponse->setStatus(true);
        } catch (Throwable $exception) {
            $connectResponse->setStatus(false);
            $connectResponse->setMessage($exception->getMessage());
        }

        return $connectResponse;
    }

    /**
     * 构建按配置连通性测试使用的底层模型实例（不走计费和高可用流程）.
     */
    private function createConnectivityModelByConfig(
        string $resolvedProviderCode,
        array $resolvedConfig,
        string $modelVersion,
        bool $embedding,
        bool $multiModal = false
    ): EmbeddingInterface|ModelInterface {
        $providerCodeEnum = ProviderCode::from($resolvedProviderCode);
        $providerConfigItem = ProviderConfigFactory::create($providerCodeEnum, $resolvedConfig);
        $providerConfigItem->setModelVersion($modelVersion);

        $implementationConfig = $providerCodeEnum->getImplementationConfig($providerConfigItem, $modelVersion);

        return ModelFactory::create(
            $providerCodeEnum->getImplementationForModel($embedding, $multiModal),
            $modelVersion,
            $implementationConfig,
            modelOptions: new ModelOptions([
                'chat' => ! $embedding,
                'function_call' => ! $embedding,
                'embedding' => $embedding,
                'multi_modal' => $multiModal,
            ])
        );
    }

    private function resolveEmbeddingSupportMultiModal(
        string $organizationCode,
        string $serviceProviderConfigId,
        string $modelVersion
    ): bool {
        if ($serviceProviderConfigId === '') {
            return false;
        }

        $dataIsolation = ProviderDataIsolation::create($organizationCode);
        $models = $this->providerModelDomainService->getByProviderConfigId($dataIsolation, $serviceProviderConfigId);

        foreach ($models as $model) {
            if ($model->getModelVersion() !== $modelVersion) {
                continue;
            }

            return $model->getConfig()?->isSupportMultiModal() ?? false;
        }

        return false;
    }

    private function buildConnectivityBusinessParams(MagicUserAuthorization $authorization): array
    {
        return [
            'organization_id' => $authorization->getOrganizationCode(),
            'user_id' => $authorization->getId(),
            'source_id' => 'connectivity_test',
        ];
    }

    /**
     * 通过图片生成配置直接调用底层生成器（不包含事件分发和计费逻辑）.
     */
    private function generateImageOpenAIFormatByConfig(
        ImageGenerateModelType $imageGenerateType,
        array $imageModelConfig,
        ImageGenerateRequest $imageGenerateRequest
    ): OpenAIFormatResponse {
        if (! empty($imageModelConfig['use_proxy'])) {
            $proxyUrl = $this->resolveProxyUrl($imageModelConfig);
            if ($proxyUrl) {
                $imageModelConfig['proxy_url'] = $proxyUrl;
            }
        }

        $imageGenerateService = ImageGenerateFactory::create($imageGenerateType, $imageModelConfig);
        return $imageGenerateService->generateImageOpenAIFormat($imageGenerateRequest);
    }

    /**
     * 解析代理 URL.
     */
    private function resolveProxyUrl(array $config): ?string
    {
        return di(ProxyConfigResolverInterface::class)->resolve($config);
    }
}
