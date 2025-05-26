<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\ModelGateway\Mapper\OdinModel;
use App\Domain\ModelAdmin\Constant\ServiceProviderType;
use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\Dto\AbstractRequestDTO;
use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Domain\ModelGateway\Entity\Dto\EmbeddingsDTO;
use App\Domain\ModelGateway\Entity\Dto\ProxyModelRequestInterface;
use App\Domain\ModelGateway\Entity\ModelConfigEntity;
use App\Domain\ModelGateway\Entity\MsgLogEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\ErrorCode\MagicApiErrorCode;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointResponseDTO;
use App\Infrastructure\Core\HighAvailability\Interface\HighAvailabilityInterface;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateFactory;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\MiracleVision\MiracleVisionModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\MiracleVision\MiracleVisionModelResponse;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\MiracleVisionModelRequest;
use App\Infrastructure\ExternalAPI\MagicAIApi\MagicAILocalModel;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\SSRF\Exception\SSRFException;
use App\Infrastructure\Util\SSRF\SSRFUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\ModelGateway\Assembler\EndpointAssembler;
use DateTime;
use Exception;
use Hyperf\Context\ApplicationContext;
use Hyperf\DbConnection\Db;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Api\Response\ChatCompletionStreamResponse;
use Hyperf\Odin\Api\Response\EmbeddingResponse;
use Hyperf\Odin\Api\Response\TextCompletionResponse;
use Hyperf\Odin\Contract\Api\Response\ResponseInterface;
use Hyperf\Odin\Contract\Model\EmbeddingInterface;
use Hyperf\Odin\Contract\Model\ModelInterface;
use Hyperf\Odin\Exception\LLMException;
use Hyperf\Odin\Model\AbstractModel;
use Hyperf\Odin\Model\AwsBedrockModel;
use Hyperf\Odin\Tool\Definition\ToolDefinition;
use Hyperf\Odin\Utils\MessageUtil;
use Hyperf\Odin\Utils\ToolUtil;
use Throwable;

use function Hyperf\Coroutine\defer;

class LLMAppService extends AbstractLLMAppService
{
    /**
     * @return array<ModelConfigEntity>
     */
    public function models(string $accessToken, bool $withInfo = false): array
    {
        $accessTokenEntity = $this->accessTokenDomainService->getByAccessToken($accessToken);
        if (! $accessTokenEntity) {
            ExceptionBuilder::throw(MagicApiErrorCode::TOKEN_NOT_EXIST);
        }

        $chatModels = $this->modelGatewayMapper->getChatModels($accessTokenEntity->getOrganizationCode());
        $embeddingModels = $this->modelGatewayMapper->getEmbeddingModels($accessTokenEntity->getOrganizationCode());

        $models = array_merge($chatModels, $embeddingModels);

        $list = [];
        foreach ($models as $name => $odinModel) {
            /** @var AbstractModel $model */
            $model = $odinModel->getModel();

            $modelConfigEntity = new ModelConfigEntity();
            // 服务商的接入点
            $modelConfigEntity->setModel($model->getModelName());
            // 模型类型
            $modelConfigEntity->setType($odinModel->getAttributes()->getKey());
            $modelConfigEntity->setName($odinModel->getAttributes()->getLabel() ?: $odinModel->getAttributes()->getName());
            $modelConfigEntity->setOwnerBy($odinModel->getAttributes()->getOwner());
            $modelConfigEntity->setCreatedAt($odinModel->getAttributes()->getCreatedAt());
            if ($withInfo) {
                $modelConfigEntity->setInfo([
                    'attributes' => $odinModel->getAttributes()->toArray(),
                    'options' => $model->getModelOptions()->toArray(),
                ]);
            }

            $list[$name] = $modelConfigEntity;
        }

        return $list;
    }

    /**
     * 聊天补全.
     */
    public function chatCompletion(CompletionDTO $sendMsgDTO): ResponseInterface
    {
        return $this->processRequest($sendMsgDTO, function (ModelInterface $model, CompletionDTO $request) {
            return $this->callChatModel($model, $request);
        });
    }

    /**
     * 处理嵌入请求.
     */
    public function embeddings(EmbeddingsDTO $proxyModelRequest): ResponseInterface
    {
        return $this->processRequest($proxyModelRequest, function (EmbeddingInterface $model, EmbeddingsDTO $request) {
            return $this->callEmbeddingsModel($model, $request);
        });
    }

    /**
     * @throws Exception
     */
    public function imageGenerate(MagicUserAuthorization $authorization, string $modelVersion, string $modelId, array $data): array
    {
        $serviceProviderResponse = $this->serviceProviderDomainService->getServiceProviderConfig($modelVersion, $modelId, $authorization->getOrganizationCode());
        if ($serviceProviderResponse === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
        }
        if ($serviceProviderResponse->getServiceProviderType() === ServiceProviderType::NORMAL) {
            $modelVersion = $serviceProviderResponse->getServiceProviderModelsEntity()->getModelVersion();
        }
        if (empty($modelVersion)) {
            $modelVersion = $serviceProviderResponse->getServiceProviderModelsEntity()->getModelVersion();
        }
        if (! isset($data['model'])) {
            $data['model'] = $modelVersion;
        }
        $imageGenerateType = ImageGenerateModelType::fromModel($modelVersion, false);
        $imageGenerateRequest = ImageGenerateFactory::createRequestType($imageGenerateType, $data);
        $imageGenerateRequest->setGenerateNum($data['generate_num'] ?? 4);
        $serviceProviderConfig = $serviceProviderResponse->getServiceProviderConfig();
        if ($serviceProviderConfig === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
        }
        $imageGenerateService = ImageGenerateFactory::create($imageGenerateType, $serviceProviderConfig);

        // 收集配置信息并处理敏感数据
        $configInfo = [
            'model' => $data['model'] ?? '',
            'apiKey' => $this->serviceProviderDomainService->maskString($serviceProviderConfig->getApiKey()),
            'ak' => $this->serviceProviderDomainService->maskString($serviceProviderConfig->getAk()),
            'sk' => $this->serviceProviderDomainService->maskString($serviceProviderConfig->getSk()),
        ];

        $this->logger->info('图像生成服务配置信息', $configInfo);

        $imageGenerateResponse = $imageGenerateService->generateImage($imageGenerateRequest);
        $images = $imageGenerateResponse->getData();
        $this->logger->info('images', $images);
        $this->recordImageGenerateMessageLog($modelVersion, $authorization->getId(), $authorization->getOrganizationCode());
        return $images;
    }

    /**
     * @throws SSRFException
     */
    public function imageConvertHigh(MagicUserAuthorization $userAuthorization, string $url): string
    {
        $url = SSRFUtil::getSafeUrl($url, replaceIp: false);
        $miracleVisionServiceProviderConfig = $this->serviceProviderDomainService->getMiracleVisionServiceProviderConfig(ImageGenerateModelType::MiracleVisionHightModelId->value, $userAuthorization->getOrganizationCode());
        /**
         * @var MiracleVisionModel $imageGenerateService
         */
        $imageGenerateService = ImageGenerateFactory::create(ImageGenerateModelType::MiracleVision, $miracleVisionServiceProviderConfig->getServiceProviderConfig());
        $this->recordImageGenerateMessageLog(ImageGenerateModelType::MiracleVisionHightModelId->value, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());
        return $imageGenerateService->imageConvertHigh(new MiracleVisionModelRequest($url));
    }

    /**
     * @throws Exception
     */
    public function imageConvertHighQuery(MagicUserAuthorization $userAuthorization, string $taskId): MiracleVisionModelResponse
    {
        $miracleVisionServiceProviderConfig = $this->serviceProviderDomainService->getMiracleVisionServiceProviderConfig(ImageGenerateModelType::MiracleVisionHightModelId->value, $userAuthorization->getOrganizationCode());
        /**
         * @var MiracleVisionModel $imageGenerateService
         */
        $imageGenerateService = ImageGenerateFactory::create(ImageGenerateModelType::MiracleVision, $miracleVisionServiceProviderConfig->getServiceProviderConfig());
        return $imageGenerateService->queryTask($taskId);
    }

    /**
     * 通用请求处理流程.
     *
     * @param ProxyModelRequestInterface $proxyModelRequest 请求对象
     * @param callable $modelCallFunction 模型调用函数，接收模型配置和请求对象，返回响应
     */
    protected function processRequest(ProxyModelRequestInterface $proxyModelRequest, callable $modelCallFunction): ResponseInterface
    {
        $endpointResponseDTO = null;
        try {
            // 验证访问令牌与模型权限
            $accessToken = $this->validateAccessToken($proxyModelRequest);

            // 数据隔离处理
            $dataIsolation = LLMDataIsolation::create()->disabled();

            // 解析业务参数
            $contextData = $this->parseBusinessContext($dataIsolation, $accessToken, $proxyModelRequest);

            // 尝试获取高可用模型配置
            $orgCode = $contextData['organization_code'] ?? null;
            $modeId = $this->getHighAvailableModelId($proxyModelRequest->getModel(), $endpointResponseDTO, $orgCode);
            if (empty($modeId)) {
                $modeId = $proxyModelRequest->getModel();
            }

            $modelAttributes = null;

            $model = match ($proxyModelRequest->getType()) {
                'chat' => $this->modelGatewayMapper->getOrganizationChatModel($modeId, $orgCode),
                'embedding' => $this->modelGatewayMapper->getOrganizationEmbeddingModel($modeId, $orgCode),
                default => null
            };
            if (! $model) {
                ExceptionBuilder::throw(MagicApiErrorCode::MODEL_NOT_SUPPORT);
            }
            if ($model instanceof OdinModel) {
                $modelAttributes = $model->getAttributes();
                $model = $model->getModel();
            }

            // 尝试使用 model_name 再次获取真实数据
            if ($model instanceof MagicAILocalModel) {
                $modelId = $model->getModelName();
                $model = match ($proxyModelRequest->getType()) {
                    'chat' => $this->modelGatewayMapper->getOrganizationChatModel($modelId, $orgCode),
                    'embedding' => $this->modelGatewayMapper->getOrganizationEmbeddingModel($modelId, $orgCode),
                    default => null
                };
                if ($model instanceof OdinModel) {
                    $modelAttributes = $model->getAttributes();
                    $model = $model->getModel();
                }
            }

            // 防止死循环
            if (! $model || $model instanceof MagicAILocalModel) {
                ExceptionBuilder::throw(MagicApiErrorCode::MODEL_NOT_SUPPORT);
            }

            if ($model instanceof AwsBedrockModel && method_exists($model, 'setConfig')) {
                $model->setConfig(array_merge($model->getConfig(), $this->createAwsAutoCacheConfig($proxyModelRequest)));
            }

            // 记录开始时间
            $startTime = microtime(true);

            $proxyModelRequest->addBusinessParam('app_id', $contextData['app_code'] ?? '');
            $proxyModelRequest->addBusinessParam('service_provider_model_id', $modelAttributes?->getProviderModelId() ?? '');

            // 调用 LLM 模型获取响应
            /** @var ResponseInterface $response */
            $response = $modelCallFunction($model, $proxyModelRequest);

            // 计算响应耗时（毫秒）
            $responseTime = (int) ((microtime(true) - $startTime) * 1000);

            $usageData = [
                'tokens' => $response->getUsage()?->getTotalTokens() ?? 0,
                'amount' => 0, // todo 计费系统
            ];

            $this->logger->info('ModelCallSuccess', [
                'model' => $proxyModelRequest->getModel(),
                'access_token_id' => $accessToken->getId(),
                'used_tokens' => $usageData['tokens'],
                'used_amount' => $usageData['amount'],
                'response_time' => $responseTime,
            ]);

            // 如果拿到了接入点，那么进行正常情况的高可用数据上报
            $this->reportHighAvailabilityResponse(
                $endpointResponseDTO,
                $responseTime,
                200, // 正常情况使用 200 状态码
                0,   // 业务状态码标记为成功
                1
            );

            // 异步处理使用记录和计费
            $this->scheduleUsageRecording($dataIsolation, $proxyModelRequest, $contextData, $usageData);

            return $response;
        } catch (BusinessException $exception) {
            $startTime = $startTime ?? microtime(true);
            // 业务异常直接抛出，避免异常码转换
            // 计算响应耗时
            $responseTime = (int) ((microtime(true) - $startTime) * 1000);

            // 如果拿到了接入点，那么进行异常情况的高可用数据上报
            $this->reportHighAvailabilityResponse(
                $endpointResponseDTO,
                $responseTime,
                400, // 业务异常使用 400 状态码
                $exception->getCode(), // 业务状态码
                0,
                $exception
            );

            $this->logModelCallFailure($proxyModelRequest->getModel(), $exception);
            throw $exception;
        } catch (Throwable $throwable) {
            $startTime = $startTime ?? microtime(true);
            // 计算响应耗时
            $responseTime = (int) ((microtime(true) - $startTime) * 1000);
            // 如果拿到了接入点，那么进行异常情况的高可用数据上报
            $this->reportHighAvailabilityResponse(
                $endpointResponseDTO,
                $responseTime,
                500, // 异常情况默认使用 500 状态码
                $throwable->getCode(), // 业务状态码标记为失败
                0,
                $throwable
            );

            $message = '';
            if ($throwable instanceof LLMException) {
                $message = $throwable->getMessage();
            }
            $this->logModelCallFailure($proxyModelRequest->getModel(), $throwable);
            ExceptionBuilder::throw(MagicApiErrorCode::MODEL_RESPONSE_FAIL, $message, throwable: $throwable);
        }
    }

    /**
     * 调用 LLM 模型获取响应.
     */
    protected function callChatModel(ModelInterface $model, CompletionDTO $proxyModelRequest): ResponseInterface
    {
        return $this->callWithOdinChat($model, $proxyModelRequest);
    }

    /**
     * 调用嵌入模型.
     */
    protected function callEmbeddingsModel(EmbeddingInterface $embedding, EmbeddingsDTO $proxyModelRequest): EmbeddingResponse
    {
        return $embedding->embeddings(input: $proxyModelRequest->getInput(), user: $proxyModelRequest->getUser(), businessParams: $proxyModelRequest->getBusinessParams());
    }

    /**
     * 获取高可用模型配置
     * 尝试从HighAvailabilityInterface获取可用的模型接入点.
     */
    protected function getHighAvailableModelId(string $modelType, ?EndpointResponseDTO &$endpointResponseDTO, ?string $orgCode = null): ?string
    {
        $highAvailable = $this->getHighAvailabilityService();
        if ($highAvailable === null) {
            return null;
        }
        // 获取可用的接入点
        $highAvailableEndpoint = $highAvailable->getAvailableEndpoint(EndpointAssembler::getEndpointTypeByModelIdAndOrgCode($modelType, $orgCode));
        if (! $highAvailableEndpoint || ! $highAvailableEndpoint->getName()) {
            return null;
        }
        $endpointResponseDTO = new EndpointResponseDTO();
        // 后续高可用的数据统计分析，需要传入高可用表自己的 id
        $endpointResponseDTO->setEndpointId($highAvailableEndpoint->getId());
        // 模型的配置 id
        $modelEndpointId = $highAvailableEndpoint->getName();
        $serviceProviderModel = $this->serviceProviderDomainService->getModelById($modelEndpointId);

        return (string) $serviceProviderModel->getId();
    }

    /**
     * 获取高可用服务实例
     * 如果高可用服务不存在或无法获取，则返回null.
     */
    private function getHighAvailabilityService(): ?HighAvailabilityInterface
    {
        $container = ApplicationContext::getContainer();

        if (! $container->has(HighAvailabilityInterface::class)) {
            return null;
        }

        try {
            $highAvailable = $container->get(HighAvailabilityInterface::class);
        } catch (Throwable) {
            return null;
        }

        if (! $highAvailable instanceof HighAvailabilityInterface) {
            return null;
        }

        return $highAvailable;
    }

    /**
     * 向高可用服务上报响应数据.
     *
     * @param ?EndpointResponseDTO $endpointResponseDTO 接入点响应DTO
     * @param int $responseTime 响应时间（毫秒）
     * @param int $httpStatusCode HTTP状态码
     * @param int $businessStatusCode 业务状态码
     * @param int $isSuccess 是否成功
     * @param ?Throwable $throwable 异常信息（如果有）
     */
    private function reportHighAvailabilityResponse(
        ?EndpointResponseDTO $endpointResponseDTO,
        int $responseTime,
        int $httpStatusCode,
        int $businessStatusCode,
        int $isSuccess,
        ?Throwable $throwable = null
    ): void {
        $highAvailable = $this->getHighAvailabilityService();
        if ($highAvailable === null || $endpointResponseDTO === null) {
            return;
        }
        // 构建接入点响应DTO
        $endpointResponseDTO
            ->setRequestId((string) CoContext::getOrSetRequestId())
            ->setResponseTime($responseTime)
            ->setHttpStatusCode($httpStatusCode)
            ->setBusinessStatusCode($businessStatusCode)
            ->setIsSuccess($isSuccess);

        // 如果有异常信息，添加异常相关数据
        if ($throwable !== null) {
            $endpointResponseDTO
                ->setExceptionType(get_class($throwable))
                ->setExceptionMessage($throwable->getMessage());
        }

        // 记录高可用响应
        $highAvailable->recordResponse($endpointResponseDTO);
    }

    /**
     * 验证访问令牌.
     */
    private function validateAccessToken(ProxyModelRequestInterface $proxyModelRequest): AccessTokenEntity
    {
        $accessToken = $this->accessTokenDomainService->getByAccessToken($proxyModelRequest->getAccessToken());
        if (! $accessToken) {
            ExceptionBuilder::throw(MagicApiErrorCode::TOKEN_NOT_EXIST);
        }

        $accessToken->checkModel($proxyModelRequest->getModel());
        $accessToken->checkIps($proxyModelRequest->getIps());
        $accessToken->checkExpiredTime(new DateTime());

        return $accessToken;
    }

    /**
     * 解析业务上下文数据.
     */
    private function parseBusinessContext(
        LLMDataIsolation $dataIsolation,
        AccessTokenEntity $accessToken,
        ProxyModelRequestInterface $proxyModelRequest
    ): array {
        $context = [
            'app_code' => null,
            'organization_code' => null,
            'user_id' => null,
            'business_id' => null,
            'source_id' => $proxyModelRequest->getBusinessParam('source_id') ?? '',
            'user_name' => $proxyModelRequest->getBusinessParam('user_name') ?? '',
            'organization_config' => null,
            'user_config' => null,
        ];

        if ($accessToken->getType()->isApplication()) {
            $this->handleApplicationContext($dataIsolation, $accessToken, $proxyModelRequest, $context);
        }

        if ($accessToken->getType()->isUser()) {
            $context['user_id'] = $accessToken->getRelationId();
            // 个人用户也有创建 token时候所在的组织。
            $context['organization_code'] = $accessToken->getOrganizationCode();
        }

        // 组织级别的 token
        if ($accessToken->getType()->isOrganization()) {
            $context['organization_code'] = $accessToken->getRelationId();
        }

        if ($context['user_id']) {
            $context['user_config'] = $this->userConfigDomainService->getByAppCodeAndOrganizationCode(
                $dataIsolation,
                $context['app_code'],
                $context['organization_code'],
                $context['user_id']
            );
            $context['user_config']->checkRpm();
            $context['user_config']->checkAmount();
        }

        return $context;
    }

    /**
     * 处理应用级别的上下文数据.
     */
    private function handleApplicationContext(
        LLMDataIsolation $dataIsolation,
        AccessTokenEntity $accessToken,
        ProxyModelRequestInterface $proxyModelRequest,
        array &$context
    ): void {
        // 组织 ID、用户 ID 必填
        $organizationId = $proxyModelRequest->getBusinessParam('organization_id', true);
        $context['user_id'] = $proxyModelRequest->getBusinessParam('user_id', true);
        $context['business_id'] = $proxyModelRequest->getBusinessParam('business_id') ?? '';

        $context['organization_config'] = $this->organizationConfigDomainService->getByAppCodeAndOrganizationCode(
            $dataIsolation,
            $accessToken->getRelationId(),
            $organizationId
        );
        $context['organization_config']->checkRpm();
        $context['organization_config']->checkAmount();

        $context['app_code'] = $accessToken->getRelationId();
        $context['organization_code'] = $organizationId;
    }

    /**
     * 使用 Odin 调用模型.
     */
    private function callWithOdinChat(ModelInterface $odinModel, CompletionDTO $sendMsgDTO): ChatCompletionResponse|ChatCompletionStreamResponse|TextCompletionResponse
    {
        $messages = [];
        foreach ($sendMsgDTO->getMessages() as $messageArray) {
            $message = MessageUtil::createFromArray($messageArray);
            if ($message) {
                $messages[] = $message;
            }
        }
        $tools = [];
        foreach ($sendMsgDTO->getTools() as $toolArray) {
            if ($toolArray instanceof ToolDefinition) {
                $tools[] = $toolArray;
                continue;
            }
            $tool = ToolUtil::createFromArray($toolArray);
            if ($tool) {
                $tools[] = $tool;
            }
        }

        return match ($sendMsgDTO->getCallMethod()) {
            AbstractRequestDTO::METHOD_COMPLETIONS => $odinModel->completions(
                prompt: $sendMsgDTO->getPrompt(),
                temperature: $sendMsgDTO->getTemperature(),
                maxTokens: $sendMsgDTO->getMaxTokens(),
                stop: $sendMsgDTO->getStop() ?? [],
                frequencyPenalty: $sendMsgDTO->getFrequencyPenalty(),
                presencePenalty: $sendMsgDTO->getPresencePenalty(),
                businessParams: $sendMsgDTO->getBusinessParams(),
            ),
            AbstractRequestDTO::METHOD_CHAT_COMPLETIONS => match ($sendMsgDTO->isStream()) {
                true => $odinModel->chatStream(
                    messages: $messages,
                    temperature: $sendMsgDTO->getTemperature(),
                    maxTokens: $sendMsgDTO->getMaxTokens(),
                    stop: $sendMsgDTO->getStop() ?? [],
                    tools: $tools,
                    frequencyPenalty: $sendMsgDTO->getFrequencyPenalty(),
                    presencePenalty: $sendMsgDTO->getPresencePenalty(),
                    businessParams: $sendMsgDTO->getBusinessParams(),
                ),
                default => $odinModel->chat(
                    messages: $messages,
                    temperature: $sendMsgDTO->getTemperature(),
                    maxTokens: $sendMsgDTO->getMaxTokens(),
                    stop: $sendMsgDTO->getStop() ?? [],
                    tools: $tools,
                    frequencyPenalty: $sendMsgDTO->getFrequencyPenalty(),
                    presencePenalty: $sendMsgDTO->getPresencePenalty(),
                    businessParams: $sendMsgDTO->getBusinessParams(),
                ),
            },
            default => ExceptionBuilder::throw(MagicApiErrorCode::MODEL_RESPONSE_FAIL, 'Unsupported call method'),
        };
    }

    /**
     * 安排使用记录和计费.
     */
    private function scheduleUsageRecording(LLMDataIsolation $dataIsolation, ProxyModelRequestInterface $proxyModelRequest, array $contextData, array $usageData): void
    {
        // 记录日志
        defer(function () use ($dataIsolation, $proxyModelRequest, $contextData, $usageData) {
            try {
                $this->recordMessageLog($dataIsolation, $proxyModelRequest, $contextData, $usageData);

                // 处理计费
                if ($usageData['amount'] > 0) {
                    $this->processUsageBilling($dataIsolation, $proxyModelRequest, $contextData, $usageData);
                }
            } catch (Throwable $e) {
                // 记录使用记录失败不应该影响用户请求响应
                $this->logger->error('处理使用记录失败', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        });
    }

    /**
     * 记录消息日志.
     */
    private function recordMessageLog(LLMDataIsolation $dataIsolation, ProxyModelRequestInterface $proxyModelRequest, array $contextData, array $usageData): void
    {
        $msgLog = new MsgLogEntity();
        $msgLog->setUseAmount((float) $usageData['amount']);
        $msgLog->setUseToken($usageData['tokens']);
        $msgLog->setModel($proxyModelRequest->getModel());
        $msgLog->setUserId($contextData['user_id']);
        $msgLog->setAppCode($contextData['app_code'] ?? '');
        $msgLog->setOrganizationCode($contextData['organization_code'] ?? '');
        $msgLog->setBusinessId($contextData['business_id'] ?? '');
        $msgLog->setSourceId($contextData['source_id']);
        $msgLog->setUserName($contextData['user_name']);
        $msgLog->setCreatedAt(new DateTime());
        $this->msgLogDomainService->create($dataIsolation, $msgLog);
    }

    /**
     * 处理使用计费.
     */
    private function processUsageBilling(LLMDataIsolation $dataIsolation, ProxyModelRequestInterface $proxyModelRequest, array $contextData, array $usageData): void
    {
        $modelConfig = $this->modelConfigDomainService->getByModel($proxyModelRequest->getModel());
        $accessToken = $this->accessTokenDomainService->getByAccessToken($proxyModelRequest->getAccessToken());

        if (! $modelConfig || ! $accessToken) {
            return;
        }

        $amount = (float) $usageData['amount'];

        Db::transaction(function () use ($dataIsolation, $modelConfig, $contextData, $accessToken, $amount) {
            // 模型额度追加
            $this->modelConfigDomainService->incrementUseAmount($dataIsolation, $modelConfig, $amount);

            // AccessToken 的额度
            $this->accessTokenDomainService->incrementUseAmount($dataIsolation, $accessToken, $amount);

            // 个人额度
            if ($contextData['user_config']) {
                $this->userConfigDomainService->incrementUseAmount($dataIsolation, $contextData['user_config'], $amount);
            }

            // 应用版 组织的额度
            if ($contextData['organization_config'] && $accessToken?->getType()->isApplication()) {
                $this->organizationConfigDomainService->incrementUseAmount($dataIsolation, $contextData['organization_config'], $amount);
            }
        });
    }

    /**
     * 记录模型调用失败日志.
     */
    private function logModelCallFailure(string $model, Throwable $throwable): void
    {
        $this->logger->warning('ModelCallFail', [
            'model' => $model,
            'error' => $throwable->getMessage(),
            'file' => $throwable->getFile(),
            'line' => $throwable->getLine(),
            'trace' => $throwable->getTraceAsString(),
        ]);
    }

    /**
     * 记录文生图日志.
     */
    private function recordImageGenerateMessageLog(string $modelVersion, string $userId, string $organizationCode): void
    {
        // 记录日志
        defer(function () use ($modelVersion, $userId, $organizationCode) {
            $LLMDataIsolation = LLMDataIsolation::create($userId, $organizationCode);

            $nickname = $this->magicUserDomainService->getUserById($userId)?->getNickname();
            $msgLog = new MsgLogEntity();
            $msgLog->setModel($modelVersion);
            $msgLog->setUserId($userId);
            $msgLog->setUseAmount(0);
            $msgLog->setUseToken(0);
            $msgLog->setAppCode('');
            $msgLog->setOrganizationCode($organizationCode);
            $msgLog->setBusinessId('');
            $msgLog->setSourceId('image_generate');
            $msgLog->setUserName($nickname);
            $msgLog->setCreatedAt(new DateTime());
            $this->msgLogDomainService->create($LLMDataIsolation, $msgLog);
        });
    }

    private function createAwsAutoCacheConfig(ProxyModelRequestInterface $proxyModelRequest): array
    {
        $autoCache = $proxyModelRequest->getHeaderConfig('AWS-AutoCache', true);
        if ($autoCache === 'false') {
            $autoCache = false;
        }
        $autoCache = (bool) $autoCache;

        $maxCachePoints = (int) $proxyModelRequest->getHeaderConfig('AWS-MaxCachePoints', 4);
        $maxCachePoints = max(min($maxCachePoints, 4), 1);

        $minCacheTokens = (int) $proxyModelRequest->getHeaderConfig('AWS-MinCacheTokens', 2048);
        $minCacheTokens = max($minCacheTokens, 2048);

        $refreshPointMinTokens = (int) $proxyModelRequest->getHeaderConfig('AWS-RefreshPointMinTokens', 5000);
        $refreshPointMinTokens = max($refreshPointMinTokens, 2048);

        return [
            'auto_cache' => $autoCache,
            'auto_cache_config' => [
                // 最大缓存点数量
                'max_cache_points' => $maxCachePoints,
                // 缓存点最小生效 tokens 阈值。tools+system 的最小缓存 tokens
                'min_cache_tokens' => $minCacheTokens,
                // 刷新缓存点的最小 tokens 阈值。messages 的最小缓存 tokens
                'refresh_point_min_tokens' => $refreshPointMinTokens,
            ],
        ];
    }
}
