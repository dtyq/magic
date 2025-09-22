<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\ModelGateway\Mapper\ModelFilter;
use App\Application\ModelGateway\Mapper\OdinModel;
use App\Domain\Chat\DTO\ImageConvertHigh\Request\MagicChatImageConvertHighReqDTO;
use App\Domain\Chat\Entity\ValueObject\AIImage\AIImageGenerateParamsVO;
use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
use App\Domain\ImageGenerate\ValueObject\ImplicitWatermark;
use App\Domain\ImageGenerate\ValueObject\WatermarkConfig;
use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\Dto\AbstractRequestDTO;
use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Domain\ModelGateway\Entity\Dto\EmbeddingsDTO;
use App\Domain\ModelGateway\Entity\Dto\ImageEditDTO;
use App\Domain\ModelGateway\Entity\Dto\ProxyModelRequestInterface;
use App\Domain\ModelGateway\Entity\Dto\TextGenerateImageDTO;
use App\Domain\ModelGateway\Entity\ModelConfigEntity;
use App\Domain\ModelGateway\Entity\MsgLogEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Event\ImageGeneratedEvent;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\ErrorCode\ImageGenerateErrorCode;
use App\ErrorCode\MagicApiErrorCode;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointDTO;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointRequestDTO;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointResponseDTO;
use App\Infrastructure\Core\HighAvailability\Entity\ValueObject\HighAvailabilityAppType;
use App\Infrastructure\Core\HighAvailability\Interface\HighAvailabilityInterface;
use App\Infrastructure\Core\Model\ImageGenerationModel;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateFactory;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\MiracleVision\MiracleVisionModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\MiracleVision\MiracleVisionModelResponse;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\MiracleVisionModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\ExternalAPI\MagicAIApi\MagicAILocalModel;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\SSRF\Exception\SSRFException;
use App\Infrastructure\Util\SSRF\SSRFUtil;
use App\Infrastructure\Util\StringMaskUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\ModelGateway\Assembler\EndpointAssembler;
use DateTime;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Exception;
use Hyperf\Codec\Json;
use Hyperf\Context\ApplicationContext;
use Hyperf\Context\Context;
use Hyperf\Odin\Api\Request\ChatCompletionRequest;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Api\Response\ChatCompletionStreamResponse;
use Hyperf\Odin\Api\Response\EmbeddingResponse;
use Hyperf\Odin\Api\Response\TextCompletionResponse;
use Hyperf\Odin\Contract\Api\Response\ResponseInterface;
use Hyperf\Odin\Contract\Model\EmbeddingInterface;
use Hyperf\Odin\Contract\Model\ModelInterface;
use Hyperf\Odin\Exception\OdinException;
use Hyperf\Odin\Model\AbstractModel;
use Hyperf\Odin\Model\AwsBedrockModel;
use Hyperf\Odin\Tool\Definition\ToolDefinition;
use Hyperf\Odin\Utils\MessageUtil;
use Hyperf\Odin\Utils\ToolUtil;
use Hyperf\Redis\Redis;
use InvalidArgumentException;
use Psr\Http\Message\ResponseInterface as PsrResponseInterface;
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

        $modelFilter = new ModelFilter();
        $modelFilter->setAppId($accessTokenEntity->getRelationId());
        $modelFilter->setCurrentPackage($this->packageFilter->getCurrentPackage($accessTokenEntity->getOrganizationCode()));

        $chatModels = $this->modelGatewayMapper->getChatModels($accessTokenEntity->getOrganizationCode(), $modelFilter);
        $embeddingModels = $this->modelGatewayMapper->getEmbeddingModels($accessTokenEntity->getOrganizationCode(), $modelFilter);
        $imageModels = $this->modelGatewayMapper->getImageModels($accessTokenEntity->getOrganizationCode());

        $models = array_merge($chatModels, $embeddingModels, $imageModels);

        $list = [];
        foreach ($models as $name => $odinModel) {
            /** @var AbstractModel $model */
            $model = $odinModel->getModel();

            $modelConfigEntity = new ModelConfigEntity();

            // Determine object type based on model class name
            $isImageModel = $model instanceof ImageGenerationModel;
            $objectType = $isImageModel ? 'image' : 'model';

            // Set common fields
            $modelConfigEntity->setModel($model->getModelName());
            $modelConfigEntity->setType($odinModel->getAttributes()->getKey());
            $modelConfigEntity->setName($odinModel->getAttributes()->getLabel() ?: $odinModel->getAttributes()->getName());
            $modelConfigEntity->setOwnerBy($odinModel->getAttributes()->getOwner());
            $modelConfigEntity->setCreatedAt($odinModel->getAttributes()->getCreatedAt());
            $modelConfigEntity->setObject($objectType);

            // Only set info for non-image models when withInfo is true
            if ($withInfo && ! $isImageModel) {
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
    public function chatCompletion(CompletionDTO $sendMsgDTO, ?ModelFilter $modelFilter = null): ResponseInterface
    {
        return $this->processRequest($sendMsgDTO, function (ModelInterface $model, CompletionDTO $request) {
            return $this->callChatModel($model, $request);
        }, $modelFilter ?? new ModelFilter());
    }

    /**
     * Process embedding requests.
     */
    public function embeddings(EmbeddingsDTO $proxyModelRequest, ?ModelFilter $modelFilter = null): ResponseInterface
    {
        return $this->processRequest($proxyModelRequest, function (EmbeddingInterface $model, EmbeddingsDTO $request) {
            return $this->callEmbeddingsModel($model, $request);
        }, $modelFilter ?? new ModelFilter());
    }

    public function textGenerateImageV2(TextGenerateImageDTO $textGenerateImageDTO): ResponseInterface
    {
        // 使用统一的 processRequest 处理流程
        return $this->processRequest($textGenerateImageDTO, function (ImageModel $imageModel, TextGenerateImageDTO $request) {
            return $this->callImageModel($imageModel, $request);
        }, new ModelFilter());
    }

    /**
     * @throws Exception
     */
    public function imageGenerate(MagicUserAuthorization $authorization, string $modelVersion, string $modelId, array $data): array
    {
        $providerConfigEntity = $this->serviceProviderDomainService->getServiceProviderConfig($modelVersion, $modelId, $authorization->getOrganizationCode());
        if ($providerConfigEntity === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
        }

        if (! isset($data['model'])) {
            $data['model'] = $modelVersion;
        }

        if (! is_array($data['reference_images'])) {
            $data['reference_images'] = [$data['reference_images']];
        }
        $data['organization_code'] = $authorization->getOrganizationCode();

        $imageGenerateType = ImageGenerateModelType::fromModel($modelVersion, false);
        $imageGenerateRequest = ImageGenerateFactory::createRequestType($imageGenerateType, $data);
        $imageGenerateRequest->setGenerateNum($data['generate_num'] ?? 4);

        $providerConfigItem = $providerConfigEntity->getConfig();
        if ($providerConfigItem === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
        }
        $imageGenerateService = ImageGenerateFactory::create($imageGenerateType, $providerConfigItem->toArray());

        // Collect configuration information and handle sensitive data
        $configInfo = [
            'model' => $data['model'] ?? '',
            'apiKey' => StringMaskUtil::mask($providerConfigItem->getApiKey()),
            'ak' => StringMaskUtil::mask($providerConfigItem->getAk()),
            'sk' => StringMaskUtil::mask($providerConfigItem->getSk()),
        ];

        $this->logger->info('Image generation service configuration', $configInfo);

        $watermarkConfig = new WatermarkConfig(ImageWatermarkProcessor::WATERMARK_TEXT, 9, 0.3);
        $imageGenerateRequest->setWatermarkConfig($watermarkConfig);

        $implicitWatermark = new ImplicitWatermark();
        $implicitWatermark->setOrganizationCode($authorization->getOrganizationCode())
            ->setUserId($authorization->getId())
            ->setAgentId($data['agent_id'] ?? '');
        $imageGenerateRequest->setImplicitWatermark($implicitWatermark);
        $imageGenerateResponse = $imageGenerateService->generateImage($imageGenerateRequest);

        if ($imageGenerateResponse->getImageGenerateType() === ImageGenerateType::BASE_64) {
            $images = $this->processBase64Images($imageGenerateResponse->getData(), $authorization);
        } else {
            $images = $imageGenerateResponse->getData();
        }

        $this->logger->info('images', $images);
        $this->recordImageGenerateMessageLog($modelVersion, $authorization->getId(), $authorization->getOrganizationCode());

        // 发布图片生成事件
        $imageGeneratedEvent = new ImageGeneratedEvent();
        $imageGeneratedEvent->setOrganizationCode($authorization->getOrganizationCode());
        $imageGeneratedEvent->setUserId($authorization->getId());
        $imageGeneratedEvent->setModel($modelVersion);
        $imageGeneratedEvent->setImageCount($data['generate_num'] ?? 4);
        $imageGeneratedEvent->setCreatedAt(new DateTime());
        $sourceType = ImageGenerateSourceEnum::NONE;
        if (isset($data['source_type'])) {
            if ($data['source_type'] instanceof ImageGenerateSourceEnum) {
                $sourceType = $data['source_type'];
            } elseif (is_string($data['source_type'])) {
                $sourceType = ImageGenerateSourceEnum::from($data['source_type']);
            }
        }
        $imageGeneratedEvent->setSourceType($sourceType);
        $imageGeneratedEvent->setSourceId($data['source_id'] ?? '');

        AsyncEventUtil::dispatch($imageGeneratedEvent);

        return $images;
    }

    /**
     * @throws SSRFException
     */
    public function imageConvertHigh(MagicUserAuthorization $userAuthorization, MagicChatImageConvertHighReqDTO $reqDTO): string
    {
        $url = $reqDTO->getOriginImageUrl();
        $url = SSRFUtil::getSafeUrl($url, replaceIp: false);
        $miracleVisionServiceProviderConfig = $this->serviceProviderDomainService->getMiracleVisionServiceProviderConfig(ImageGenerateModelType::MiracleVisionHightModelId->value, $userAuthorization->getOrganizationCode());
        /**
         * @var MiracleVisionModel $imageGenerateService
         */
        $imageGenerateService = ImageGenerateFactory::create(ImageGenerateModelType::MiracleVision, $miracleVisionServiceProviderConfig->getConfig()->toArray());
        $this->recordImageGenerateMessageLog(ImageGenerateModelType::MiracleVisionHightModelId->value, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

        $imageGeneratedEvent = new ImageGeneratedEvent();
        $imageGeneratedEvent->setOrganizationCode($userAuthorization->getOrganizationCode());
        $imageGeneratedEvent->setUserId($userAuthorization->getId());
        $imageGeneratedEvent->setImageCount(1);
        $imageGeneratedEvent->setCreatedAt(new DateTime());
        $imageGeneratedEvent->setModel(ImageGenerateModelType::MiracleVisionHightModelId->value);
        $imageGeneratedEvent->setSourceType($reqDTO->getSourceType());
        $imageGeneratedEvent->setSourceId($reqDTO->getSourceId());

        $event = new ImageGeneratedEvent();
        AsyncEventUtil::dispatch($event);

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
        $imageGenerateService = ImageGenerateFactory::create(ImageGenerateModelType::MiracleVision, $miracleVisionServiceProviderConfig->getConfig()->toArray());
        return $imageGenerateService->queryTask($taskId);
    }

    public function textGenerateImage(TextGenerateImageDTO $textGenerateImageDTO): array
    {
        $accessTokenEntity = $this->validateAccessToken($textGenerateImageDTO);

        $dataIsolation = LLMDataIsolation::create()->disabled();

        $contextData = $this->parseBusinessContext($dataIsolation, $accessTokenEntity, $textGenerateImageDTO);
        $organizationCode = $contextData['organization_code'];
        $creator = $contextData['user_id'];

        $modelVersion = $textGenerateImageDTO->getModel();
        $serviceProviderConfigs = $this->serviceProviderDomainService->getOfficeAndActiveModel($modelVersion, Category::VLM);
        $imageGenerateType = ImageGenerateModelType::fromModel($modelVersion, false);

        $imageGenerateParamsVO = new AIImageGenerateParamsVO();
        $imageGenerateParamsVO->setModel($modelVersion);
        $imageGenerateParamsVO->setUserPrompt($textGenerateImageDTO->getPrompt());
        $imageGenerateParamsVO->setGenerateNum($textGenerateImageDTO->getN());
        $imageGenerateParamsVO->setSequentialImageGeneration($textGenerateImageDTO->getSequentialImageGeneration());
        $imageGenerateParamsVO->setSequentialImageGenerationOptions($textGenerateImageDTO->getSequentialImageGenerationOptions());

        $size = $textGenerateImageDTO->getSize();
        [$width, $height] = explode('x', $size);

        // 计算字符串格式的比例，如 "1:1", "3:4"
        $ratio = $this->calculateRatio((int) $width, (int) $height);
        $imageGenerateParamsVO->setRatio($ratio);
        $imageGenerateParamsVO->setWidth($width);
        $imageGenerateParamsVO->setHeight($height);

        // 从服务商配置数组中取第一个进行处理
        if (empty($serviceProviderConfigs)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
        }

        $data = $imageGenerateParamsVO->toArray();
        $data['organization_code'] = $organizationCode;

        $imageGenerateRequest = ImageGenerateFactory::createRequestType($imageGenerateType, $data);

        $imageGenerateRequest->setWatermarkConfig($textGenerateImageDTO->getWatermark());

        $implicitWatermark = new ImplicitWatermark();
        $implicitWatermark->setOrganizationCode($organizationCode)
            ->setUserId($creator)
            ->setTopicId($textGenerateImageDTO->getTopicId());

        $imageGenerateRequest->setImplicitWatermark($implicitWatermark);
        $imageGenerateRequest->setValidityPeriod(1);

        $errorMessage = '';
        foreach ($serviceProviderConfigs as $serviceProviderConfig) {
            $imageGenerateService = ImageGenerateFactory::create($imageGenerateType, $serviceProviderConfig->toArray());
            try {
                $generateImageRaw = $imageGenerateService->generateImageRawWithWatermark($imageGenerateRequest);
                if (! empty($generateImageRaw)) {
                    $this->recordImageGenerateMessageLog($modelVersion, $creator, $organizationCode);
                    $n = $textGenerateImageDTO->getN();
                    // 除了 mj 是 1 次之外，其他都按张数算
                    if (in_array($modelVersion, ImageGenerateModelType::getMidjourneyModes())) {
                        $n = 1;
                    }
                    $event = $this->buildImageGenerateEntity($creator, $organizationCode, $textGenerateImageDTO, $n);
                    AsyncEventUtil::dispatch($event);

                    return $generateImageRaw;
                }
            } catch (Exception $e) {
                $errorMessage = $e->getMessage();
                $this->logger->warning('text generate image error:' . $e->getMessage());
            }
        }
        ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $errorMessage);
    }

    /**
     * Image editing with uploaded files using volcano image generation models.
     */
    public function imageEdit(ImageEditDTO $imageEditDTO): array
    {
        $accessTokenEntity = $this->validateAccessToken($imageEditDTO);

        $dataIsolation = LLMDataIsolation::create()->disabled();

        $contextData = $this->parseBusinessContext($dataIsolation, $accessTokenEntity, $imageEditDTO);
        $organizationCode = $contextData['organization_code'];
        $creator = $contextData['user_id'];

        $modelVersion = $imageEditDTO->getModel();
        $serviceProviderConfigs = $this->serviceProviderDomainService->getOfficeAndActiveModel($modelVersion, Category::VLM);
        $imageGenerateType = ImageGenerateModelType::fromModel($modelVersion, false);

        $imageGenerateParamsVO = new AIImageGenerateParamsVO();
        $imageGenerateParamsVO->setModel($modelVersion);
        $imageGenerateParamsVO->setUserPrompt($imageEditDTO->getPrompt());
        $imageGenerateParamsVO->setReferenceImages($imageEditDTO->getImages());
        $data = $imageGenerateParamsVO->toArray();
        $data['organization_code'] = $organizationCode;
        $imageGenerateRequest = ImageGenerateFactory::createRequestType($imageGenerateType, $data);
        $implicitWatermark = new ImplicitWatermark();
        $imageGenerateRequest->setGenerateNum(1); // 图生图默认只能 1
        $implicitWatermark->setOrganizationCode($organizationCode)
            ->setUserId($creator)
            ->setTopicId($imageEditDTO->getTopicId());

        $imageGenerateRequest->setImplicitWatermark($implicitWatermark);
        foreach ($serviceProviderConfigs as $serviceProviderConfig) {
            $imageGenerateService = ImageGenerateFactory::create($imageGenerateType, $serviceProviderConfig->toArray());
            try {
                $generateImageRaw = $imageGenerateService->generateImageRawWithWatermark($imageGenerateRequest);
                if (! empty($generateImageRaw)) {
                    $event = $this->buildImageGenerateEntity($creator, $organizationCode, $imageEditDTO, 1);

                    AsyncEventUtil::dispatch($event);

                    return $generateImageRaw;
                }
            } catch (Exception $e) {
                $this->logger->warning('text generate image error:' . $e->getMessage());
            }
        }
        ExceptionBuilder::throw(ImageGenerateErrorCode::NOT_FOUND_ERROR_CODE);
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
            foreach ($hashes as $removeCount => $messagesHash) {
                // Skip removeCount=0 (full array) since we only check conversation continuation
                if ($removeCount === 0) {
                    continue;
                }

                // Generate cache key using the pre-calculated hash
                $cacheKey = $messagesHash . ':' . $model;
                $endpointCacheKey = self::CONVERSATION_ENDPOINT_PREFIX . $cacheKey;

                $cacheKeys[] = $endpointCacheKey;
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
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
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
    protected function processRequest(ProxyModelRequestInterface $proxyModelRequest, callable $modelCallFunction, ModelFilter $modelFilter): ResponseInterface
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
            //            $this->pointComponent->checkPointsSufficient($contextData['organization_code'], $contextData['user_id']);

            // Try to get high availability model configuration
            $orgCode = $contextData['organization_code'] ?? null;

            // Check if high availability is enabled
            if ($proxyModelRequest->isEnableHighAvailability()) {
                $modeId = $this->getHighAvailableModelId($proxyModelRequest, $endpointDTO, $orgCode);
                if (empty($modeId)) {
                    $modeId = $proxyModelRequest->getModel();
                }
            } else {
                // High availability is disabled, use the original model ID directly
                $modeId = $proxyModelRequest->getModel();
            }

            $modelAttributes = null;

            $modelFilter->setAppId($accessToken->getRelationId());
            $modelFilter->setOriginModel($proxyModelRequest->getModel());
            $modelFilter->setCurrentPackage($this->packageFilter->getCurrentPackage($orgCode ?? ''));

            try {
                $model = match ($proxyModelRequest->getType()) {
                    'chat' => $this->modelGatewayMapper->getOrganizationChatModel($modeId, $orgCode, $modelFilter),
                    'embedding' => $this->modelGatewayMapper->getOrganizationEmbeddingModel($modeId, $orgCode, $modelFilter),
                    'image' => $this->modelGatewayMapper->getOrganizationImageModel($modeId, $orgCode, $modelFilter),
                    default => null
                };
                if ($model instanceof OdinModel) {
                    $modelAttributes = $model->getAttributes();
                    $model = $model->getModel();
                }
                // Try to use model_name to get real data again
                if ($model instanceof MagicAILocalModel) {
                    $modelId = $model->getModelName();
                    $model = match ($proxyModelRequest->getType()) {
                        'chat' => $this->modelGatewayMapper->getOrganizationChatModel($modelId, $orgCode, $modelFilter),
                        'embedding' => $this->modelGatewayMapper->getOrganizationEmbeddingModel($modelId, $orgCode, $modelFilter),
                        default => null
                    };
                    if ($model instanceof OdinModel) {
                        $modelAttributes = $model->getAttributes();
                        $model = $model->getModel();
                    }
                }
            } catch (Throwable $throwable) {
                ExceptionBuilder::throw(MagicApiErrorCode::MODEL_NOT_SUPPORT, throwable: $throwable);
            }

            // Prevent infinite loop
            if (! $model || $model instanceof MagicAILocalModel) {
                ExceptionBuilder::throw(MagicApiErrorCode::MODEL_NOT_SUPPORT);
            }
            /* @phpstan-ignore-next-line */
            if ($model instanceof AwsBedrockModel && method_exists($model, 'setConfig')) {
                $model->setConfig(array_merge($model->getConfig(), $this->createAwsAutoCacheConfig($proxyModelRequest, $model->getModelName())));
            }
            // Record start time
            $startTime = microtime(true);

            $proxyModelRequest->addBusinessParam('model_id', $proxyModelRequest->getModel());
            $proxyModelRequest->addBusinessParam('app_id', $contextData['app_code'] ?? '');
            $proxyModelRequest->addBusinessParam('service_provider_id', $modelAttributes?->getProviderId() ?? '');
            $proxyModelRequest->addBusinessParam('service_provider_model_id', $modelAttributes?->getProviderModelId() ?? '');
            $proxyModelRequest->addBusinessParam('source_id', $contextData['source_id'] ?? '');
            $proxyModelRequest->addBusinessParam('user_name', $contextData['user_name'] ?? '');
            $proxyModelRequest->addBusinessParam('organization_id', $contextData['organization_code'] ?? '');
            $proxyModelRequest->addBusinessParam('user_id', $contextData['user_id'] ?? '');
            $proxyModelRequest->addBusinessParam('access_token_id', $accessToken->getId());

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

            // If endpoint is obtained and high availability is enabled, report high availability data in normal cases
            if ($proxyModelRequest->isEnableHighAvailability()) {
                $this->reportHighAvailabilityResponse(
                    $endpointDTO,
                    $responseTime,
                    200, // Use 200 status code in normal cases
                    0,   // Business status code marked as success
                    1
                );
            }

            return $response;
        } catch (Throwable $throwable) {
            $this->handleRequestException($endpointDTO, $startTime ?? microtime(true), $proxyModelRequest, $throwable, 500);

            $message = '';
            if ($throwable instanceof OdinException || $throwable instanceof InvalidArgumentException) {
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
        try {
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
        } catch (Throwable $e) {
            $this->logger->warning('endpointHighAvailability failed to get high available model ID', [
                'model' => $proxyModelRequest->getModel(),
                'orgCode' => $orgCode,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Reset endpointDTO to null when exception occurs
            $endpointDTO = null;
            return null;
        }
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
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * 调用图片生成模型.
     */
    protected function callImageModel(ImageModel $imageModel, TextGenerateImageDTO $proxyModelRequest): OpenAIFormatResponse
    {
        $organizationCode = $proxyModelRequest->getBusinessParam('organization_id');
        $creator = $proxyModelRequest->getBusinessParam('user_id');

        $modelVersion = $imageModel->getModelVersion();

        $imageGenerateType = ImageGenerateModelType::fromModel($modelVersion, false);

        // 构建图片生成参数
        $imageGenerateParamsVO = new AIImageGenerateParamsVO();
        $imageGenerateParamsVO->setModel($modelVersion);
        $imageGenerateParamsVO->setUserPrompt($proxyModelRequest->getPrompt());
        $imageGenerateParamsVO->setGenerateNum($proxyModelRequest->getN());
        $imageGenerateParamsVO->setSequentialImageGeneration($proxyModelRequest->getSequentialImageGeneration());
        $imageGenerateParamsVO->setSequentialImageGenerationOptions($proxyModelRequest->getSequentialImageGenerationOptions());

        $size = $proxyModelRequest->getSize();
        [$width, $height] = explode('x', $size);

        // 计算字符串格式的比例，如 "1:1", "3:4"
        $ratio = $this->calculateRatio((int) $width, (int) $height);
        $imageGenerateParamsVO->setRatio($ratio);
        $imageGenerateParamsVO->setWidth($width);
        $imageGenerateParamsVO->setHeight($height);

        $data = $imageGenerateParamsVO->toArray();
        $data['organization_code'] = $organizationCode;

        $imageGenerateRequest = ImageGenerateFactory::createRequestType($imageGenerateType, $data);
        $imageGenerateRequest->setWatermarkConfig($proxyModelRequest->getWatermark());

        $implicitWatermark = new ImplicitWatermark();
        $implicitWatermark->setOrganizationCode($organizationCode)
            ->setUserId($creator)
            ->setTopicId($proxyModelRequest->getTopicId());

        $imageGenerateRequest->setImplicitWatermark($implicitWatermark);
        $imageGenerateRequest->setValidityPeriod(1);

        $imageGenerateService = ImageGenerateFactory::create($imageGenerateType, $imageModel->getConfig());
        $generateImageOpenAIFormat = $imageGenerateService->generateImageOpenAIFormat($imageGenerateRequest);

        try {
            // 记录日志
            $this->recordImageGenerateMessageLog($modelVersion, $creator, $organizationCode);

            // 计算计费数量
            $n = $proxyModelRequest->getN();
            // 除了 mj和 图生图 是 1 次之外，其他都按张数算
            if (in_array($modelVersion, ImageGenerateModelType::getMidjourneyModes())) {
                $n = 1;
            }

            // 发布事件
            $event = $this->buildImageGenerateEntity($creator, $organizationCode, $proxyModelRequest, $n);
            AsyncEventUtil::dispatch($event);
        } catch (Exception $e) {
            $errorMessage = $e->getMessage();
            $generateImageOpenAIFormat->setProviderErrorMessage($errorMessage);
            $generateImageOpenAIFormat->setProviderErrorCode($e->getCode());
            $generateImageOpenAIFormat->setProvider('magic');
            $this->logger->warning('text generate image error:' . $e->getMessage());
        }

        return $generateImageOpenAIFormat;
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
            // Ensure message is an array
            if (! is_array($message)) {
                continue;
            }

            // Extract and concatenate parts for current message directly to string
            $cumulativeHashString .= $this->convertToString($message['role'] ?? '');
            $cumulativeHashString .= $this->convertToString($message['content'] ?? '');
            $cumulativeHashString .= $this->convertToString($message['name'] ?? '');
            $cumulativeHashString .= $this->convertToString($message['tool_call_id'] ?? '');

            // Handle tool_calls
            if (isset($message['tool_calls']) && is_array($message['tool_calls'])) {
                foreach ($message['tool_calls'] as $toolCall) {
                    if (! is_array($toolCall)) {
                        continue;
                    }
                    $cumulativeHashString .= $this->convertToString($toolCall['id'] ?? '');
                    $cumulativeHashString .= $this->convertToString($toolCall['type'] ?? '');
                    if (isset($toolCall['function']) && is_array($toolCall['function'])) {
                        $cumulativeHashString .= $this->convertToString($toolCall['function']['name'] ?? '');
                        $cumulativeHashString .= $this->convertToString($toolCall['function']['arguments'] ?? '');
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
     * Convert value to string safely, handling arrays, objects, and other types.
     *
     * @param mixed $value Value to convert
     * @return string String representation
     */
    private function convertToString(mixed $value): string
    {
        if (is_string($value)) {
            return $value;
        }

        if (is_null($value)) {
            return '';
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        if (is_array($value) || is_object($value)) {
            return Json::encode($value) ?: '';
        }

        if (is_scalar($value)) {
            return (string) $value;
        }

        // For resources or other non-serializable types
        return gettype($value);
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

        // Report to high availability service if endpoint is available and high availability is enabled
        if ($proxyModelRequest->isEnableHighAvailability()) {
            $this->reportHighAvailabilityResponse(
                $endpointDTO,
                $responseTime,
                $httpStatusCode,
                $throwable->getCode(),
                0,
                $throwable
            );
        }

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
            $context['source_id'] = $accessToken->getName();
            // Personal users also have the organization they were in when creating the token
            $context['organization_code'] = $accessToken->getOrganizationCode();
        }

        // Organization level token
        if ($accessToken->getType()->isOrganization()) {
            $context['organization_code'] = $accessToken->getRelationId();
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

        $chatRequest = new ChatCompletionRequest(
            messages: $messages,
            temperature: $sendMsgDTO->getTemperature(),
            maxTokens: $sendMsgDTO->getMaxTokens(),
            stop: $sendMsgDTO->getStop() ?? [],
            tools: $tools,
        );
        $chatRequest->setFrequencyPenalty($sendMsgDTO->getFrequencyPenalty());
        $chatRequest->setPresencePenalty($sendMsgDTO->getPresencePenalty());
        $chatRequest->setBusinessParams($sendMsgDTO->getBusinessParams());
        $chatRequest->setThinking($sendMsgDTO->getThinking());

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
                true => $odinModel->chatStreamWithRequest($chatRequest),
                default => $odinModel->chatWithRequest($chatRequest),
            },
            default => ExceptionBuilder::throw(MagicApiErrorCode::MODEL_RESPONSE_FAIL, 'Unsupported call method'),
        };
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

    private function createAwsAutoCacheConfig(ProxyModelRequestInterface $proxyModelRequest, string $modelName): array
    {
        // 只有包含 anthropic.claude 的模型
        if (! str_contains($modelName, 'anthropic.claude')) {
            return [];
        }
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

        if (Context::has(PsrResponseInterface::class)) {
            $response = Context::get(PsrResponseInterface::class);
            $response = $response
                ->withHeader('AWS-AutoCache', $autoCache ? 'true' : 'false')
                ->withHeader('AWS-MaxCachePoints', (string) $maxCachePoints)
                ->withHeader('AWS-MinCacheTokens', (string) $minCacheTokens)
                ->withHeader('AWS-RefreshPointMinTokens', (string) $refreshPointMinTokens);
            Context::set(PsrResponseInterface::class, $response);
        }

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
     * Calculate the width-to-height ratio.
     * @return string "1:1", "3:4", "16:9"
     */
    private function calculateRatio(int $width, int $height): string
    {
        $gcd = $this->gcd($width, $height);

        $ratioWidth = $width / $gcd;
        $ratioHeight = $height / $gcd;

        return $ratioWidth . ':' . $ratioHeight;
    }

    /**
     * Calculate the greatest common divisor using Euclidean algorithm.
     * Improved version with proper error handling and edge case management.
     */
    private function gcd(int $a, int $b): int
    {
        // Handle edge case where both numbers are zero
        if ($a === 0 && $b === 0) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed);
        }

        // Use absolute values to ensure positive result
        $a = (int) abs($a);
        $b = (int) abs($b);

        // Iterative approach to avoid stack overflow for large numbers
        while ($b !== 0) {
            $temp = $b;
            $b = $a % $b;
            $a = $temp;
        }

        return $a;
    }

    /**
     * Process base64 images by uploading them to file storage and returning accessible URLs.
     *
     * @param array $images Array of base64 encoded images
     * @param MagicUserAuthorization $authorization User authorization for organization context
     * @return array Array of processed image URLs or original base64 data on failure
     */
    private function processBase64Images(array $images, MagicUserAuthorization $authorization): array
    {
        $processedImages = [];

        foreach ($images as $index => $base64Image) {
            try {
                $subDir = 'open';

                $uploadFile = new UploadFile($base64Image, $subDir, '');

                $this->fileDomainService->uploadByCredential($authorization->getOrganizationCode(), $uploadFile, StorageBucketType::Public);

                $fileLink = $this->fileDomainService->getLink($authorization->getOrganizationCode(), $uploadFile->getKey(), StorageBucketType::Public);
                if ($fileLink === null) {
                    continue;
                }
                $processedImages[] = $fileLink->getUrl();
            } catch (Exception $e) {
                $this->logger->error('Failed to process base64 image', [
                    'index' => $index,
                    'error' => $e->getMessage(),
                    'organization_code' => $authorization->getOrganizationCode(),
                ]);
                // If upload fails, keep the original base64 data
                $processedImages[] = $base64Image;
            }
        }

        return $processedImages;
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
        $messagesHash = $hashes[0] ?? hash('sha256', '');

        // Generate cache key using messages hash + model
        $cacheKey = $messagesHash . ':' . $model;

        return self::CONVERSATION_ENDPOINT_PREFIX . $cacheKey;
    }

    private function buildImageGenerateEntity(string $creator, string $organizationCode, AbstractRequestDTO $requestDTO, int $n): ImageGeneratedEvent
    {
        $imageGeneratedEvent = new ImageGeneratedEvent();

        $model = $requestDTO->getModel();

        $imageGeneratedEvent->setOrganizationCode($organizationCode);
        $imageGeneratedEvent->setUserId($creator);
        $imageGeneratedEvent->setModel($model);
        $imageGeneratedEvent->setImageCount($n);
        $imageGeneratedEvent->setTopicId($requestDTO->getTopicId());
        $imageGeneratedEvent->setTaskId($requestDTO->getTaskId());
        $imageGeneratedEvent->setCreatedAt(new DateTime());
        if (! empty($requestDTO->getTopicId())) {
            $imageGeneratedEvent->setSourceType(ImageGenerateSourceEnum::SUPER_MAGIC);
        } else {
            $imageGeneratedEvent->setSourceType(ImageGenerateSourceEnum::API);
        }

        return $imageGeneratedEvent;
    }
}
