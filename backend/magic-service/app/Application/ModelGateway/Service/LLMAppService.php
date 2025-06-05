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
use App\Infrastructure\Core\HighAvailability\DTO\EndpointDTO;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointRequestDTO;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointResponseDTO;
use App\Infrastructure\Core\HighAvailability\Entity\ValueObject\HighAvailabilityAppType;
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
use Hyperf\Redis\Redis;
use InvalidArgumentException;
use Throwable;

use function Hyperf\Coroutine\defer;

class LLMAppService extends AbstractLLMAppService
{
    /**
     * Conversation endpoint memory cache prefix.
     */
    private const string CONVERSATION_ENDPOINT_PREFIX = 'conversation_endpoint:';

    /**
     * Conversation endpoint memory cache expiration time (seconds).
     */
    private const int CONVERSATION_ENDPOINT_TTL = 3600; // 1 hour

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
            // Service provider endpoint
            $modelConfigEntity->setModel($model->getModelName());
            // Model type
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
     * Chat completion.
     */
    public function chatCompletion(CompletionDTO $sendMsgDTO): ResponseInterface
    {
        return $this->processRequest($sendMsgDTO, function (ModelInterface $model, CompletionDTO $request) {
            return $this->callChatModel($model, $request);
        });
    }

    /**
     * Process embedding requests.
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

        // Collect configuration information and handle sensitive data
        $configInfo = [
            'model' => $data['model'] ?? '',
            'apiKey' => $this->serviceProviderDomainService->maskString($serviceProviderConfig->getApiKey()),
            'ak' => $this->serviceProviderDomainService->maskString($serviceProviderConfig->getAk()),
            'sk' => $this->serviceProviderDomainService->maskString($serviceProviderConfig->getSk()),
        ];

        $this->logger->info('Image generation service configuration', $configInfo);

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
     * Get remembered endpoint ID for conversation.
     * Returns historical endpoint ID if conversation continuation detected, otherwise null.
     * Uses messages array minus the last message to generate cache key.
     *
     * @param CompletionDTO $completionDTO Chat completion request DTO
     * @return null|string Returns endpoint ID if continuation detected, otherwise null
     */
    public function getRememberedEndpointId(CompletionDTO $completionDTO): ?string
    {
        $messages = $completionDTO->getMessages();

        // Must have at least 2 messages to be a continuation
        if (count($messages) < 2) {
            return null;
        }

        $model = $completionDTO->getModel();

        try {
            $redis = $this->getRedisInstance();
            if (! $redis) {
                return null;
            }

            // Calculate multiple hashes at once to optimize performance
            $hashes = $this->calculateMultipleMessagesHashes($messages, 3);

            // Prepare cache keys for batch query (skip removeCount=0)
            $cacheKeys = [];
            $removeCountMapping = [];
            foreach ($hashes as $removeCount => $messagesHash) {
                // Skip removeCount=0 (full array) since we only check conversation continuation
                if ($removeCount === 0) {
                    continue;
                }

                // Generate cache key using the pre-calculated hash
                $cacheKey = $messagesHash . ':' . $model;
                $endpointCacheKey = self::CONVERSATION_ENDPOINT_PREFIX . $cacheKey;

                $cacheKeys[] = $endpointCacheKey;
                $removeCountMapping[$endpointCacheKey] = $removeCount;
            }

            // Batch query Redis for all cache keys at once
            $endpointIds = $redis->mget($cacheKeys);

            // Process results in order (removeCount 1, 2, 3)
            foreach ($cacheKeys as $index => $endpointCacheKey) {
                $endpointId = $endpointIds[$index] ?? null;
                $isContinuation = ! empty($endpointId);
                // Return endpoint ID if this is a continuation
                if ($isContinuation) {
                    return $endpointId;
                }
            }

            // No match found after trying all available hashes
            return null;
        } catch (Throwable $e) {
            $this->logger->warning('endpointHighAvailability failed to check conversation continuation', [
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * General request processing workflow.
     *
     * @param ProxyModelRequestInterface $proxyModelRequest Request object
     * @param callable $modelCallFunction Model calling function that receives model configuration and request object, returns response
     */
    protected function processRequest(ProxyModelRequestInterface $proxyModelRequest, callable $modelCallFunction): ResponseInterface
    {
        /** @var null|EndpointDTO $endpointDTO */
        $endpointDTO = null;
        try {
            // Validate access token and model permissions
            $accessToken = $this->validateAccessToken($proxyModelRequest);

            // Data isolation handling
            $dataIsolation = LLMDataIsolation::create()->disabled();

            // Parse business parameters
            $contextData = $this->parseBusinessContext($dataIsolation, $accessToken, $proxyModelRequest);

            // Try to get high availability model configuration
            $orgCode = $contextData['organization_code'] ?? null;
            $modeId = $this->getHighAvailableModelId($proxyModelRequest, $endpointDTO, $orgCode);
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

            // Try to use model_name to get real data again
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

            // Prevent infinite loop
            if (! $model || $model instanceof MagicAILocalModel) {
                ExceptionBuilder::throw(MagicApiErrorCode::MODEL_NOT_SUPPORT);
            }

            if ($model instanceof AwsBedrockModel && method_exists($model, 'setConfig')) {
                $model->setConfig(array_merge($model->getConfig(), $this->createAwsAutoCacheConfig($proxyModelRequest)));
            }

            // Record start time
            $startTime = microtime(true);

            $proxyModelRequest->addBusinessParam('app_id', $contextData['app_code'] ?? '');
            $proxyModelRequest->addBusinessParam('service_provider_model_id', $modelAttributes?->getProviderModelId() ?? '');

            // Call LLM model to get response
            /** @var ResponseInterface $response */
            $response = $modelCallFunction($model, $proxyModelRequest);

            // Calculate response time (milliseconds)
            $responseTime = (int) ((microtime(true) - $startTime) * 1000);

            $usageData = [
                'tokens' => $response->getUsage()?->getTotalTokens() ?? 0,
                'amount' => 0, // todo billing system
            ];

            $this->logger->info('ModelCallSuccess', [
                'model' => $proxyModelRequest->getModel(),
                'access_token_id' => $accessToken->getId(),
                'used_tokens' => $usageData['tokens'],
                'used_amount' => $usageData['amount'],
                'response_time' => $responseTime,
            ]);

            // If endpoint is obtained, report high availability data in normal cases
            $this->reportHighAvailabilityResponse(
                $endpointDTO,
                $responseTime,
                200, // Use 200 status code in normal cases
                0,   // Business status code marked as success
                1
            );

            // Asynchronous processing of usage records and billing
            $this->scheduleUsageRecording($dataIsolation, $proxyModelRequest, $contextData, $usageData);

            return $response;
        } catch (BusinessException $exception) {
            // Business exceptions should be distinguished from endpoint exceptions for high availability
            // This helps the HA system differentiate between client-side errors (400) and server-side errors (500)
            // which improves the effectiveness of endpoint health monitoring and failover decisions
            $this->handleRequestException($endpointDTO, $startTime ?? microtime(true), $proxyModelRequest, $exception, 400);
            throw $exception;
        } catch (Throwable $throwable) {
            $this->handleRequestException($endpointDTO, $startTime ?? microtime(true), $proxyModelRequest, $throwable, 500);

            $message = '';
            if ($throwable instanceof LLMException || $throwable instanceof InvalidArgumentException) {
                $message = $throwable->getMessage();
            }
            ExceptionBuilder::throw(MagicApiErrorCode::MODEL_RESPONSE_FAIL, $message, throwable: $throwable);
        }
    }

    /**
     * Call LLM model to get response.
     */
    protected function callChatModel(ModelInterface $model, CompletionDTO $proxyModelRequest): ResponseInterface
    {
        return $this->callWithOdinChat($model, $proxyModelRequest);
    }

    /**
     * Call embedding model.
     */
    protected function callEmbeddingsModel(EmbeddingInterface $embedding, EmbeddingsDTO $proxyModelRequest): EmbeddingResponse
    {
        return $embedding->embeddings(input: $proxyModelRequest->getInput(), user: $proxyModelRequest->getUser(), businessParams: $proxyModelRequest->getBusinessParams());
    }

    /**
     * Get high availability model configuration.
     * Try to get available model endpoints from HighAvailabilityInterface.
     * For conversation continuation, prioritize using remembered endpoint ID.
     */
    protected function getHighAvailableModelId(ProxyModelRequestInterface $proxyModelRequest, ?EndpointDTO &$endpointDTO, ?string $orgCode = null): ?string
    {
        $highAvailable = $this->getHighAvailabilityService();
        if ($highAvailable === null) {
            return null;
        }

        // If it's a chat request, try to get remembered endpoint ID (conversation continuation already checked internally)
        $rememberedEndpointId = null;
        if ($proxyModelRequest instanceof CompletionDTO) {
            $rememberedEndpointId = $this->getRememberedEndpointId($proxyModelRequest);
        }

        // Use EndpointAssembler to generate standardized endpoint type identifier
        $modelType = $proxyModelRequest->getModel();
        $formattedModelType = EndpointAssembler::generateEndpointType(
            HighAvailabilityAppType::MODEL_GATEWAY,
            $modelType
        );

        // Create endpoint request DTO
        $endpointRequest = EndpointRequestDTO::create(
            endpointType: $formattedModelType,
            orgCode: $orgCode ?? '',
            lastSelectedEndpointId: $rememberedEndpointId
        );

        // Get available endpoints
        $endpointDTO = $highAvailable->getAvailableEndpoint($endpointRequest);

        // Log only when remembered endpoint ID matches the current endpoint ID
        if ($rememberedEndpointId && $endpointDTO && $rememberedEndpointId === $endpointDTO->getEndpointId()) {
            $this->logger->info('endpointHighAvailability sameConversationEndpoint', [
                'remembered_endpoint_id' => $rememberedEndpointId,
                'current_endpoint_id' => $endpointDTO->getEndpointId(),
                'model' => $modelType,
                'is_same_endpoint' => true,
            ]);
        }

        // If it's a chat request and got a new endpoint, remember this endpoint ID
        if ($proxyModelRequest instanceof CompletionDTO && $endpointDTO && $endpointDTO->getEndpointId()) {
            $this->rememberEndpointId($proxyModelRequest, $endpointDTO->getEndpointId());
        }

        // Model configuration id
        return $endpointDTO?->getBusinessId() ?: null;
    }

    /**
     * Get Redis instance.
     *
     * @return null|Redis Redis instance
     */
    protected function getRedisInstance(): ?Redis
    {
        try {
            $container = ApplicationContext::getContainer();
            if (! $container->has(Redis::class)) {
                return null;
            }

            $redis = $container->get(Redis::class);
            return $redis instanceof Redis ? $redis : null;
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * Remember the endpoint ID used for conversation.
     * Uses complete messages array to generate cache key.
     *
     * @param CompletionDTO $completionDTO Chat completion request DTO
     * @param string $endpointId Endpoint ID
     */
    protected function rememberEndpointId(CompletionDTO $completionDTO, string $endpointId): void
    {
        try {
            $redis = $this->getRedisInstance();
            if (! $redis) {
                return;
            }

            // Use complete messages array
            $messages = $completionDTO->getMessages();
            $model = $completionDTO->getModel();
            $cacheKey = $this->generateEndpointCacheKey($messages, $model);
            $redis->setex($cacheKey, self::CONVERSATION_ENDPOINT_TTL, $endpointId);
        } catch (Throwable $e) {
            $this->logger->warning('endpointHighAvailability Failed to remember endpoint ID', [
                'endpoint_id' => $endpointId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Calculate multiple hash values by removing 0 to N messages from the end.
     * Optimized to use string concatenation instead of array operations for better performance.
     *
     * @param array $messages Complete messages array
     * @param int $maxRemoveCount Maximum number of messages to remove (0 means include full array)
     * @return array Array of hash values indexed by remove count (0, 1, 2, ...)
     */
    private function calculateMultipleMessagesHashes(array $messages, int $maxRemoveCount): array
    {
        $messageCount = count($messages);
        $hashes = [];
        $cumulativeHashString = '';

        // Handle empty array case for removeCount=0
        if ($messageCount === 0 && $maxRemoveCount >= 0) {
            $hashes[0] = hash('sha256', '');
        }

        // Single loop: build cumulative hash string and calculate hashes as we go
        foreach ($messages as $index => $message) {
            // Extract and concatenate parts for current message directly to string
            $cumulativeHashString .= $message['role'] ?? '';
            $cumulativeHashString .= $message['content'] ?? '';
            $cumulativeHashString .= $message['name'] ?? '';
            $cumulativeHashString .= $message['tool_call_id'] ?? '';

            // Handle tool_calls
            if (isset($message['tool_calls']) && is_array($message['tool_calls'])) {
                foreach ($message['tool_calls'] as $toolCall) {
                    $cumulativeHashString .= $toolCall['id'] ?? '';
                    $cumulativeHashString .= $toolCall['type'] ?? '';
                    if (isset($toolCall['function'])) {
                        $cumulativeHashString .= $toolCall['function']['name'] ?? '';
                        $cumulativeHashString .= $toolCall['function']['arguments'] ?? '';
                    }
                }
            }

            // Check if current position matches any target length for removeCount calculation
            $currentMessageCount = $index + 1; // Messages processed so far

            // Handle removeCount = 0 (full array) - calculate when we reach the end
            if ($maxRemoveCount >= 0 && $currentMessageCount === $messageCount) {
                $hashes[0] = hash('sha256', $cumulativeHashString);
            }

            // Handle removeCount > 0 (removing messages from the end)
            for ($removeCount = 1; $removeCount <= $maxRemoveCount; ++$removeCount) {
                $targetMessageCount = $messageCount - $removeCount;
                if ($currentMessageCount === $targetMessageCount) {
                    // We've reached the target number of messages for this removeCount
                    $hashes[$removeCount] = hash('sha256', $cumulativeHashString);
                }
            }
        }

        return $hashes;
    }

    /**
     * Handle common exception logic for requests.
     */
    private function handleRequestException(
        ?EndpointDTO $endpointDTO,
        float $startTime,
        ProxyModelRequestInterface $proxyModelRequest,
        Throwable $throwable,
        int $httpStatusCode
    ): void {
        // Calculate response time
        $responseTime = (int) ((microtime(true) - $startTime) * 1000);

        // Report to high availability service if endpoint is available
        $this->reportHighAvailabilityResponse(
            $endpointDTO,
            $responseTime,
            $httpStatusCode,
            $throwable->getCode(),
            0,
            $throwable
        );

        $this->logModelCallFailure($proxyModelRequest->getModel(), $throwable);
    }

    /**
     * Get high availability service instance.
     * Returns null if the high availability service does not exist or cannot be obtained.
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
     * Report response data to high availability service.
     *
     * @param int $responseTime Response time (milliseconds)
     * @param int $httpStatusCode HTTP status code
     * @param int $businessStatusCode Business status code
     * @param int $isSuccess Whether successful
     * @param ?Throwable $throwable Exception information (if any)
     */
    private function reportHighAvailabilityResponse(
        ?EndpointDTO $endpointDTO,
        int $responseTime,
        int $httpStatusCode,
        int $businessStatusCode,
        int $isSuccess,
        ?Throwable $throwable = null
    ): void {
        $highAvailable = $this->getHighAvailabilityService();
        if ($highAvailable === null || $endpointDTO === null || ! $endpointDTO->getEndpointId()) {
            return;
        }
        $endpointResponseDTO = new EndpointResponseDTO();
        // Build endpoint response DTO
        $endpointResponseDTO
            ->setEndpointId($endpointDTO->getEndpointId())
            ->setRequestId((string) CoContext::getOrSetRequestId())
            ->setResponseTime($responseTime)
            ->setHttpStatusCode($httpStatusCode)
            ->setBusinessStatusCode($businessStatusCode)
            ->setIsSuccess($isSuccess);

        // Add exception related data if there is exception information
        if ($throwable !== null) {
            $endpointResponseDTO
                ->setExceptionType(get_class($throwable))
                ->setExceptionMessage($throwable->getMessage());
        }

        // Record high availability response
        $highAvailable->recordResponse($endpointResponseDTO);
    }

    /**
     * Validate access token.
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
     * Parse business context data.
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
            // Personal users also have the organization they were in when creating the token
            $context['organization_code'] = $accessToken->getOrganizationCode();
        }

        // Organization level token
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
     * Handle application-level context data.
     */
    private function handleApplicationContext(
        LLMDataIsolation $dataIsolation,
        AccessTokenEntity $accessToken,
        ProxyModelRequestInterface $proxyModelRequest,
        array &$context
    ): void {
        // Organization ID and user ID are required
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
     * Call model using Odin.
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
     * Schedule usage recording and billing.
     */
    private function scheduleUsageRecording(LLMDataIsolation $dataIsolation, ProxyModelRequestInterface $proxyModelRequest, array $contextData, array $usageData): void
    {
        // Record logs
        defer(function () use ($dataIsolation, $proxyModelRequest, $contextData, $usageData) {
            try {
                $this->recordMessageLog($dataIsolation, $proxyModelRequest, $contextData, $usageData);

                // Process billing
                if ($usageData['amount'] > 0) {
                    $this->processUsageBilling($dataIsolation, $proxyModelRequest, $contextData, $usageData);
                }
            } catch (Throwable $e) {
                // Usage record failure should not affect user request response
                $this->logger->error('Failed to process usage records', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        });
    }

    /**
     * Record message log.
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
     * Process usage billing.
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
            // Add model quota
            $this->modelConfigDomainService->incrementUseAmount($dataIsolation, $modelConfig, $amount);

            // AccessToken quota
            $this->accessTokenDomainService->incrementUseAmount($dataIsolation, $accessToken, $amount);

            // Personal quota
            if ($contextData['user_config']) {
                $this->userConfigDomainService->incrementUseAmount($dataIsolation, $contextData['user_config'], $amount);
            }

            // Organization quota for application version
            if ($contextData['organization_config'] && $accessToken?->getType()->isApplication()) {
                $this->organizationConfigDomainService->incrementUseAmount($dataIsolation, $contextData['organization_config'], $amount);
            }
        });
    }

    /**
     * Log model call failure.
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
     * Record text-to-image generation log.
     */
    private function recordImageGenerateMessageLog(string $modelVersion, string $userId, string $organizationCode): void
    {
        // Record logs
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
                // Maximum number of cache points
                'max_cache_points' => $maxCachePoints,
                // Minimum effective tokens threshold for cache points. Minimum cache tokens for tools+system
                'min_cache_tokens' => $minCacheTokens,
                // Minimum tokens threshold for refreshing cache points. Minimum cache tokens for messages
                'refresh_point_min_tokens' => $refreshPointMinTokens,
            ],
        ];
    }

    /**
     * Generate conversation endpoint cache key (based on messages hash + model).
     * Now reuses the optimized calculateMultipleMessagesHashes method.
     *
     * @param array $messages Messages array
     * @param string $model Model name
     * @return string Cache key
     */
    private function generateEndpointCacheKey(array $messages, string $model): string
    {
        // Reuse the optimized multiple hash calculation method (removeCount = 0 for full array)
        $hashes = $this->calculateMultipleMessagesHashes($messages, 0);
        $messagesHash = $hashes[0];

        // Generate cache key using messages hash + model
        $cacheKey = $messagesHash . ':' . $model;

        return self::CONVERSATION_ENDPOINT_PREFIX . $cacheKey;
    }
}
