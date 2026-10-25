<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\ModelGateway\Service\ConnectivityTest\LLMConnectivityTestExecutor;
use App\Application\ModelGateway\Service\ConnectivityTest\LLMConnectivityTestMessageBuilder;
use App\Domain\ModelGateway\Contract\VideoGenerationConnectivityTestableInterface;
use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterFactoryInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\Provider\DTO\Factory\ProviderConfigFactory;
use App\Domain\Provider\DTO\Item\ModelConfigItem;
use App\Domain\Provider\DTO\ProviderConfigDTO;
use App\Domain\Provider\Entity\ProviderModelEntity;
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
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\DTO\ConnectivityTestByConfigRequest;
use Hyperf\Odin\Api\Request\ChatCompletionRequest;
use Hyperf\Odin\Api\RequestOptions\ApiOptions;
use Hyperf\Odin\Contract\Model\EmbeddingInterface;
use Hyperf\Odin\Contract\Model\ModelInterface;
use Hyperf\Odin\Factory\ModelFactory;
use Hyperf\Odin\Model\ModelOptions;
use Hyperf\Odin\Utils\MessageUtil;
use Hyperf\Odin\Utils\ToolUtil;
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
        $modelConfig = null;
        $modelType = $request->getModelType();
        $category = Category::tryFrom($request->getCategory() ?? '');
        $serviceProviderConfigDTO = null;
        $providerModelEntity = null;

        if ($serviceProviderConfigId !== '') {
            $serviceProviderConfigDTO = $this->serviceProviderDomainService->getServiceProviderConfigDetail($serviceProviderConfigId, $authorization->getOrganizationCode());
            $category = $serviceProviderConfigDTO->getCategory();
            $serviceProviderConfig = $serviceProviderConfigDTO->getConfig()?->toArray() ?? [];
            $providerCodeEnum = $serviceProviderConfigDTO->getProviderCode();
            $providerCode = $providerCodeEnum === null ? $providerCode : $providerCodeEnum->value;
            $providerModelEntity = $this->resolveConnectivityProviderModel(
                $authorization->getOrganizationCode(),
                $serviceProviderConfigId,
                $modelVersion
            );
            $modelConfig = $providerModelEntity?->getConfig();
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
                    $modelConfig,
                    $serviceProviderConfigDTO,
                    $providerModelEntity
                ),
                NaturalLanguageProcessing::LLM => $this->llmConnectivityTestByConfig(
                    $providerCode,
                    $modelVersion,
                    $serviceProviderConfig,
                    $authorization,
                    $modelConfig,
                    $serviceProviderConfigDTO,
                    $providerModelEntity,
                    $request->getSupportMultiModal(),
                    $request->getSupportFunction()
                ),
                NaturalLanguageProcessing::VLM => $this->vlmConnectivityTestByConfig(
                    $providerCode,
                    $modelVersion,
                    $serviceProviderConfig,
                    $authorization,
                    $modelType
                ),
                NaturalLanguageProcessing::VIDEO => $this->videoConnectivityTestByConfig(
                    $providerCode,
                    $modelVersion,
                    $serviceProviderConfig,
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
        $categoryEnum = Category::tryFrom($category);
        return $categoryEnum === null
            ? NaturalLanguageProcessing::DEFAULT
            : NaturalLanguageProcessing::fromCategory($categoryEnum, $modelType);
    }

    private function videoConnectivityTestByConfig(
        string $providerCode,
        string $modelVersion,
        array $serviceProviderConfig,
    ): ConnectResponse {
        $connectResponse = new ConnectResponse();

        if ($modelVersion === '') {
            $connectResponse->setStatus(false);
            $connectResponse->setMessage('model_version is empty');
            return $connectResponse;
        }

        try {
            $providerCodeEnum = ProviderCode::from($providerCode);
            $adapter = di(VideoGenerationProviderAdapterFactoryInterface::class)->createByProviderCode(
                $providerCodeEnum,
                $modelVersion,
            );
            if (! $adapter instanceof VideoGenerationConnectivityTestableInterface) {
                throw new BusinessException(__('service_provider.connectivity_not_supported'));
            }

            if (! empty($serviceProviderConfig['use_proxy'])) {
                $proxyUrl = $this->resolveProxyUrl($serviceProviderConfig);
                if ($proxyUrl !== null && $proxyUrl !== '') {
                    $serviceProviderConfig['proxy_url'] = $proxyUrl;
                }
            }
            $connectResponse->setStatus($adapter->testConnection(
                QueueExecutorConfig::fromProviderConfig($serviceProviderConfig),
                $modelVersion,
            ));
            if (! $connectResponse->isStatus()) {
                $connectResponse->setMessage('video connectivity test failed');
            }
        } catch (Throwable $exception) {
            $connectResponse->setStatus(false);
            $connectResponse->setMessage($exception->getMessage());
        }

        return $connectResponse;
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

            //            if ($modelType && ModelType::tryFrom($modelType)->isImageToImage()) {
            //                $requestData['reference_images'] = ['https://cdn.pixabay.com/photo/2017/02/20/18/03/cat-2083492_1280.jpg'];
            //            }

            $imageGenerateRequest = ImageGenerateFactory::createRequestType(
                $imageGenerateType,
                $modelVersion,
                null,
                $requestData
            );
            $response = $this->imageConnectivityTestByConfig(
                $imageGenerateType,
                $serviceProviderConfig,
                $imageGenerateRequest
            );
            $connectResponse->setStatus($response->isSuccess());
            $connectResponse->setMessage($response->getProviderErrorMessage() ?? '');
        } catch (Throwable $exception) {
            $connectResponse->setMessage($exception->getMessage());
            $connectResponse->setStatus(false);
        }

        return $connectResponse;
    }

    private function embeddingConnectivityTestByConfig(
        string $providerCode,
        string $modelVersion,
        array $serviceProviderConfig,
        MagicUserAuthorization $authorization,
        ?ModelConfigItem $modelConfig = null,
        ?ProviderConfigDTO $serviceProviderConfigDTO = null,
        ?ProviderModelEntity $providerModelEntity = null
    ): ConnectResponse {
        $connectResponse = new ConnectResponse();

        try {
            $businessParams = $this->buildConnectivityBusinessParams(
                $authorization,
                $modelVersion,
                'embedding',
                $serviceProviderConfigDTO,
                $providerModelEntity
            );

            $model = $this->createConnectivityModelByConfig(
                $providerCode,
                $serviceProviderConfig,
                $modelVersion,
                true,
                $modelConfig
            );

            if (! $model instanceof EmbeddingInterface) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidModelType);
            }

            $model->embeddings(
                input: 'test',
                user: 'connectivity_test',
                businessParams: $businessParams
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
        MagicUserAuthorization $authorization,
        ?ModelConfigItem $modelConfig = null,
        ?ProviderConfigDTO $serviceProviderConfigDTO = null,
        ?ProviderModelEntity $providerModelEntity = null,
        ?bool $requestedSupportMultiModal = null,
        ?bool $requestedSupportFunction = null
    ): ConnectResponse {
        $supportMultiModal = $this->resolveConnectivitySupportMultiModal($modelConfig, $requestedSupportMultiModal);
        $supportFunction = $this->resolveConnectivitySupportFunction($modelConfig, $requestedSupportFunction);
        $model = null;
        $getModel = function () use (
            &$model,
            $providerCode,
            $serviceProviderConfig,
            $modelVersion,
            $modelConfig,
            $supportMultiModal,
            $supportFunction
        ): ModelInterface {
            if ($model instanceof ModelInterface) {
                return $model;
            }

            $createdModel = $this->createConnectivityModelByConfig(
                $providerCode,
                $serviceProviderConfig,
                $modelVersion,
                false,
                $modelConfig,
                $supportMultiModal,
                $supportFunction
            );
            if (! $createdModel instanceof ModelInterface) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidModelType);
            }

            $model = $createdModel;
            return $model;
        };

        return LLMConnectivityTestExecutor::execute(
            function () use (
                $getModel,
                $authorization,
                $modelVersion,
                $serviceProviderConfigDTO,
                $providerModelEntity,
                $modelConfig,
                $supportFunction
            ): void {
                $getModel()->chatWithRequest($this->buildConnectivityChatRequest(
                    LLMConnectivityTestMessageBuilder::buildTextMessages(),
                    $this->buildConnectivityBusinessParams(
                        $authorization,
                        $modelVersion,
                        'chat',
                        $serviceProviderConfigDTO,
                        $providerModelEntity
                    ),
                    $modelConfig,
                    includeFunctionCallTools: $supportFunction
                ));
            },
            $supportMultiModal,
            function () use (
                $getModel,
                $authorization,
                $modelVersion,
                $serviceProviderConfigDTO,
                $providerModelEntity
            ): void {
                $getModel()->chatWithRequest($this->buildConnectivityChatRequest(
                    LLMConnectivityTestMessageBuilder::buildMultimodalMessages(),
                    $this->buildConnectivityBusinessParams(
                        $authorization,
                        $modelVersion,
                        'chat',
                        $serviceProviderConfigDTO,
                        $providerModelEntity
                    ),
                    maxTokens: 64
                ));
            }
        );
    }

    /**
     * 构建按配置连通性测试使用的底层模型实例（不走计费和高可用流程）.
     */
    private function createConnectivityModelByConfig(
        string $resolvedProviderCode,
        array $resolvedConfig,
        string $modelVersion,
        bool $embedding,
        ?ModelConfigItem $modelConfig = null,
        ?bool $supportMultiModal = null,
        ?bool $supportFunction = null
    ): EmbeddingInterface|ModelInterface {
        $providerCodeEnum = ProviderCode::from($resolvedProviderCode);
        $providerConfigItem = ProviderConfigFactory::create($providerCodeEnum, $resolvedConfig);
        $providerConfigItem->setModelVersion($modelVersion);

        $implementationConfig = $providerCodeEnum->getImplementationConfig($providerConfigItem, $modelVersion);
        $supportMultiModal ??= $modelConfig?->isSupportMultiModal() ?? false;
        $supportFunction ??= $modelConfig?->isSupportFunction() ?? false;

        return ModelFactory::create(
            $providerCodeEnum->getImplementationForModel($embedding, $supportMultiModal),
            $modelVersion,
            $implementationConfig,
            modelOptions: $this->buildConnectivityModelOptions($embedding, $modelConfig, $supportMultiModal, $supportFunction),
            apiOptions: new ApiOptions([
                'proxy' => $this->resolveConnectivityProxy($resolvedConfig),
            ])
        );
    }

    private function buildConnectivityModelOptions(
        bool $embedding,
        ?ModelConfigItem $modelConfig = null,
        ?bool $supportMultiModal = null,
        ?bool $supportFunction = null
    ): ModelOptions {
        return new ModelOptions([
            'chat' => ! $embedding,
            'function_call' => ! $embedding && ($supportFunction ?? $modelConfig?->isSupportFunction() ?? false),
            'embedding' => $embedding,
            'multi_modal' => $supportMultiModal ?? $modelConfig?->isSupportMultiModal() ?? false,
            'vector_size' => $embedding ? ($modelConfig?->getVectorSize() ?? 0) : 0,
            'max_tokens' => $modelConfig?->getMaxTokens(),
            'max_output_tokens' => $modelConfig?->getMaxOutputTokens(),
            'default_temperature' => $modelConfig?->getCreativity(),
            'fixed_temperature' => $modelConfig?->getTemperature(),
            'chat_api' => $modelConfig?->getChatApi(),
        ]);
    }

    private function buildConnectivityChatRequest(
        array $messageArrays,
        array $businessParams,
        ?ModelConfigItem $modelConfig = null,
        ?int $maxTokens = null,
        bool $includeFunctionCallTools = false
    ): ChatCompletionRequest {
        $messages = [];
        foreach ($messageArrays as $messageArray) {
            $message = MessageUtil::createFromArray($messageArray);
            if ($message) {
                $messages[] = $message;
            }
        }

        $chatRequest = new ChatCompletionRequest(
            messages: $messages,
            temperature: $this->resolveConnectivityTemperature($modelConfig),
            maxTokens: $maxTokens ?? $this->resolveConnectivityMaxTokens($modelConfig),
            stop: [],
            tools: $this->buildConnectivityChatTools($includeFunctionCallTools)
        );
        $chatRequest->setBusinessParams($businessParams);
        return $chatRequest;
    }

    /**
     * 解析按配置连通性测试最终使用的多模态能力。
     */
    private function resolveConnectivitySupportMultiModal(
        ?ModelConfigItem $modelConfig,
        ?bool $requestedSupportMultiModal
    ): bool {
        return $modelConfig?->isSupportMultiModal() ?? $requestedSupportMultiModal ?? false;
    }

    /**
     * 解析按配置连通性测试最终使用的函数调用能力。
     */
    private function resolveConnectivitySupportFunction(
        ?ModelConfigItem $modelConfig,
        ?bool $requestedSupportFunction
    ): bool {
        return $modelConfig?->isSupportFunction() ?? $requestedSupportFunction ?? false;
    }

    /**
     * 勾选函数调用时，把固定测试 tool 转成 Odin ToolDefinition。
     */
    private function buildConnectivityChatTools(bool $includeFunctionCallTools): array
    {
        if (! $includeFunctionCallTools) {
            return [];
        }

        $tools = [];
        foreach (LLMConnectivityTestMessageBuilder::buildFunctionCallTools() as $toolArray) {
            $tool = ToolUtil::createFromArray($toolArray);
            if ($tool) {
                $tools[] = $tool;
            }
        }

        return $tools;
    }

    private function resolveConnectivityTemperature(?ModelConfigItem $modelConfig = null): float
    {
        return $modelConfig?->getTemperature()
            ?? $modelConfig?->getCreativity()
            ?? 0.7;
    }

    private function resolveConnectivityMaxTokens(?ModelConfigItem $modelConfig = null): int
    {
        return $modelConfig?->getMaxOutputTokens() ?? 10000;
    }

    private function resolveConnectivityProxy(array $config): string
    {
        if (empty($config['use_proxy'])) {
            return '';
        }

        return (string) ($this->resolveProxyUrl($config) ?? '');
    }

    private function resolveConnectivityProviderModel(
        string $organizationCode,
        string $serviceProviderConfigId,
        string $modelVersion
    ): ?ProviderModelEntity {
        if ($serviceProviderConfigId === '') {
            return null;
        }

        $dataIsolation = ProviderDataIsolation::create($organizationCode);
        $models = $this->providerModelDomainService->getByProviderConfigId($dataIsolation, $serviceProviderConfigId);

        foreach ($models as $model) {
            if ($model->getModelVersion() !== $modelVersion) {
                continue;
            }

            return $model;
        }

        return null;
    }

    private function buildConnectivityBusinessParams(
        MagicUserAuthorization $authorization,
        string $modelVersion,
        string $modelType,
        ?ProviderConfigDTO $serviceProviderConfigDTO = null,
        ?ProviderModelEntity $providerModelEntity = null
    ): array {
        $providerModelId = (string) ($providerModelEntity?->getId() ?? '');
        $modelId = $providerModelEntity?->getModelId() ?: $modelVersion;
        $modelName = $providerModelEntity?->getName() ?: $modelVersion;
        $providerName = trim($serviceProviderConfigDTO?->getAlias() ?? '');
        if ($providerName === '') {
            $providerName = $serviceProviderConfigDTO?->getName() ?? '';
        }

        return [
            'organization_id' => $authorization->getOrganizationCode(),
            'organization_code' => $authorization->getOrganizationCode(),
            'user_id' => $authorization->getId(),
            'source_id' => SourceId::CONNECTIVITY_TEST,
            'app_id' => '',
            'user_name' => '',
            'access_token_id' => '',
            'access_token_name' => '',
            'access_token_type' => '',
            'ak' => '',
            'call_time' => date('Y-m-d H:i:s'),
            'operation_time' => (int) round(microtime(true) * 1000),
            'request_id' => CoContext::getRequestId(),
            'event_id' => (string) IdGenerator::getSnowId(),
            'model_id' => $modelId,
            'original_model_id' => $modelId,
            'model_type' => $modelType,
            'model_version' => $modelVersion,
            'model_name' => $modelName,
            'provider_name' => $providerName,
            'service_provider_id' => (string) ($serviceProviderConfigDTO?->getServiceProviderId() ?? ''),
            'service_provider_model_id' => $providerModelId,
            'provider_model_id' => $providerModelId,
        ];
    }

    /**
     * 通过图片生成配置直接调用底层连通性测试（不包含事件分发和计费逻辑）.
     */
    private function imageConnectivityTestByConfig(
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
