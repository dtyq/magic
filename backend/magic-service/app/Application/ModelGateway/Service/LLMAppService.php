<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\ModelGateway\Event\ImageSearchUsageEvent;
use App\Application\ModelGateway\Event\ModelInvocationCompletedEvent;
use App\Application\ModelGateway\Event\ModelUsageEvent;
use App\Application\ModelGateway\Event\WebSearchUsageEvent;
use App\Application\ModelGateway\Mapper\ModelEntry;
use App\Application\ModelGateway\Mapper\OdinModel;
use App\Application\ModelGateway\Support\InvocationDetailInfo;
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
use App\Domain\ModelGateway\Entity\Dto\ImageSearchRequestDTO;
use App\Domain\ModelGateway\Entity\Dto\ProxyModelRequestInterface;
use App\Domain\ModelGateway\Entity\Dto\SearchRequestDTO;
use App\Domain\ModelGateway\Entity\Dto\TextGenerateImageDTO;
use App\Domain\ModelGateway\Entity\Dto\WebScrapeRequestDTO;
use App\Domain\ModelGateway\Entity\ModelConfigEntity;
use App\Domain\ModelGateway\Entity\MsgLogEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Event\ImageGeneratedEvent;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\ErrorCode\ImageGenerateErrorCode;
use App\ErrorCode\MagicApiErrorCode;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointDTO;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointRequestDTO;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointResponseDTO;
use App\Infrastructure\Core\HighAvailability\Entity\ValueObject\HighAvailabilityAppType;
use App\Infrastructure\Core\HighAvailability\Interface\HighAvailabilityInterface;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateFactory;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateModelType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateType;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\MiracleVision\MiracleVisionModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\MiracleVisionModelRequest;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\SizeManager;
use App\Infrastructure\ExternalAPI\ImageSearch\DTO\ImageSearchResponseDTO;
use App\Infrastructure\ExternalAPI\ImageSearch\Factory\ImageSearchEngineAdapterFactory;
use App\Infrastructure\ExternalAPI\MagicAIApi\MagicAILocalModel;
use App\Infrastructure\ExternalAPI\Proxy\ProxyConfigResolverInterface;
use App\Infrastructure\ExternalAPI\Search\BingSearch;
use App\Infrastructure\ExternalAPI\Search\DTO\SearchResponseDTO;
use App\Infrastructure\ExternalAPI\Search\Factory\SearchEngineAdapterFactory;
use App\Infrastructure\ExternalAPI\WebScrape\WebScrapeFactory;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;
use App\Infrastructure\ImageGenerate\WatermarkPolicyInterface;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\Http\RequestHelper;
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
use Hyperf\Odin\Api\Response\Usage;
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
     * Bing Search V1 产品标识（网关侧统计/透传）.
     */
    private const string AUDIT_PRODUCT_BING_SEARCH_V1 = 'bing_search_v1';

    /**
     * @return array<ModelConfigEntity>
     */
    public function models(string $accessToken, bool $withInfo = false, string $type = '', array $businessParams = [], bool $withDynamicModels = false): array
    {
        $dataIsolation = $this->createModelGatewayDataIsolationByAccessToken($accessToken, $businessParams);

        $models = match ($type) {
            'chat' => $this->modelGatewayMapper->getChatModels($dataIsolation, $withDynamicModels),
            'embedding' => $this->modelGatewayMapper->getEmbeddingModels($dataIsolation, $withDynamicModels),
            'image' => $this->modelGatewayMapper->getImageModels($dataIsolation, $withDynamicModels),
            'video' => $this->modelGatewayMapper->getVideoModels($dataIsolation, $withDynamicModels),
            default => $this->modelGatewayMapper->getAllModels($dataIsolation, $withDynamicModels),
        };

        if ($withInfo) {
            $iconPaths = [];
            foreach ($models as $entry) {
                $iconPaths[] = $entry->getAttributes()->getIcon();
            }
            $icons = $this->getIconsWithSmartOrganization($iconPaths);
        }

        $list = [];
        foreach ($models as $name => $entry) {
            $impl = $entry->getModel();
            $isImageModel = $entry->isImageModel();
            $isVideoModel = $entry->isVideoModel();
            $objectType = match (true) {
                $isVideoModel => 'video',
                $isImageModel => 'image',
                default => 'model',
            };

            $modelConfigEntity = new ModelConfigEntity();

            // 图片/视频模型用 modelVersion，LLM/Embedding 用 getModelName()
            if ($isImageModel || $isVideoModel) {
                $modelConfigEntity->setModel($impl->getModelVersion());
            } else {
                /** @var AbstractModel $odinImpl */
                $odinImpl = $impl->getModel();
                $modelConfigEntity->setModel($odinImpl->getModelName());
            }

            $modelConfigEntity->setType($entry->getAttributes()->getKey());
            $modelConfigEntity->setName($entry->getAttributes()->getLabel() ?: $entry->getAttributes()->getName());
            $modelConfigEntity->setOwnerBy($entry->getAttributes()->getOwner());
            $modelConfigEntity->setCreatedAt($entry->getAttributes()->getCreatedAt());
            $modelConfigEntity->setObject($objectType);

            if ($withInfo) {
                $attributes = $entry->getAttributes()->toShowArray();
                if (isset($icons[$attributes['icon']])) {
                    $attributes['icon'] = $icons[$attributes['icon']]->getUrl();
                } else {
                    $attributes['icon'] = '';
                }

                if ($isVideoModel) {
                    $info = [
                        'attributes' => $attributes,
                        'options' => [],
                    ];
                } elseif ($isImageModel) {
                    $info = [
                        'attributes' => $attributes,
                        'options' => [],
                    ];
                    /*
                     * 如果是 image 模型，添加尺寸信息
                     *
                     * 说明：当前模型配置中没有尺寸模版字段，为了简化实现和维护成本，
                     * 采用配置文件方式管理各图像模型支持的尺寸和分辨率信息。
                     *
                     * 维护说明：
                     * 1. 新增模型时，在 image_models.php 中添加对应的 match 规则和 config 配置
                     * 2. 优先使用 model_version 精准匹配，避免误匹配
                     * 3. 使用 model_id 进行模糊匹配（如豆包4.0/4.5）
                     */
                    $entryAttributes = $entry->getAttributes();
                    $imageModelConfig = SizeManager::matchConfig(
                        $entryAttributes->getName(),
                        $entryAttributes->getKey()
                    );
                    if ($imageModelConfig !== null) {
                        $info['image_size_config'] = [
                            'sizes' => $imageModelConfig['sizes'] ?? [],
                            'max_reference_images' => $imageModelConfig['max_reference_images'] ?? 0,
                        ];
                    }
                } else {
                    /** @var AbstractModel $odinImpl */
                    $odinImpl = $impl->getModel();
                    $info = [
                        'attributes' => $attributes,
                        'options' => $odinImpl->getModelOptions()->toArray(),
                    ];
                }

                $modelConfigEntity->setInfo($info);
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
        return $this->processRequest($sendMsgDTO, function (ModelGatewayDataIsolation $modelGatewayDataIsolation, ModelInterface $model, CompletionDTO $request) {
            return $this->callChatModel($model, $request);
        });
    }

    /**
     * Process embedding requests.
     */
    public function embeddings(EmbeddingsDTO $proxyModelRequest): ResponseInterface
    {
        return $this->processRequest($proxyModelRequest, function (ModelGatewayDataIsolation $modelGatewayDataIsolation, EmbeddingInterface $model, EmbeddingsDTO $request) {
            return $this->callEmbeddingsModel($model, $request);
        });
    }

    public function textGenerateImageV2(TextGenerateImageDTO $textGenerateImageDTO): ResponseInterface
    {
        return $this->processRequest($textGenerateImageDTO, function (ModelGatewayDataIsolation $modelGatewayDataIsolation, ImageModel $imageModel, TextGenerateImageDTO $request) {
            return $this->callImageModel($modelGatewayDataIsolation, $imageModel, $request);
        });
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

        // 只有model_id参数，则获取model_version
        if (empty($modelVersion) && $modelId) {
            $providerDataIsolation = new ProviderDataIsolation($authorization->getOrganizationCode(), $authorization->getId(), $authorization->getMagicId());
            $imageModelEntry = $this->modelGatewayMapper->getOrganizationImageModel($providerDataIsolation, $modelId);
            $imageModel = $imageModelEntry?->getImageModel();
            if (! $imageModel) {
                ExceptionBuilder::throw(MagicApiErrorCode::MODEL_NOT_SUPPORT);
            }
            $modelVersion = $imageModel->getModelVersion();
        }

        if (! isset($data['model'])) {
            $data['model'] = $modelVersion;
        }

        if (empty($data['reference_images'])) {
            $data['reference_images'] = [];
        }

        if (! is_array($data['reference_images'])) {
            $data['reference_images'] = [$data['reference_images']];
        }
        $data['organization_code'] = $authorization->getOrganizationCode();

        $imageGenerateType = ImageGenerateModelType::fromProviderCode($providerConfigEntity->getProviderCode(), $modelVersion);
        $imageGenerateRequest = ImageGenerateFactory::createRequestType($imageGenerateType, $modelVersion, $modelId, $data);
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
        ];

        $this->logger->info('Image generation service configuration', $configInfo);

        // 图片水印处理
        $watermarkConfig = new WatermarkConfig(ImageWatermarkProcessor::WATERMARK_TEXT, 9, 0.3);
        $imageGenerateRequest->setWatermarkConfig($watermarkConfig);

        $implicitWatermark = new ImplicitWatermark();
        $implicitWatermark->setOrganizationCode($authorization->getOrganizationCode())
            ->setUserId($authorization->getId())
            ->setAgentId($data['agent_id'] ?? '');
        $imageGenerateRequest->setImplicitWatermark($implicitWatermark);
        $imageGenerateRequest->setModel($providerConfigItem->getModelVersion());
        $startTime = microtime(true);
        $imageGenerateResponse = $imageGenerateService->generateImage($imageGenerateRequest);

        if ($imageGenerateResponse->getImageGenerateType() === ImageGenerateType::BASE_64) {
            $images = $this->processBase64Images($imageGenerateResponse->getData(), $authorization);
        } else {
            $images = $imageGenerateResponse->getData();
        }

        $this->logger->info('images', $images);
        $this->recordImageGenerateMessageLog($modelVersion, $authorization->getId(), $authorization->getOrganizationCode());

        $productCodeForAudit = $modelId !== '' ? $modelId : (string) ($data['model'] ?? $modelVersion);
        $latencyMs = (int) ((microtime(true) - $startTime) * 1000);
        $auditCount = (int) ($data['generate_num'] ?? 4);
        if (in_array($modelVersion, ImageGenerateModelType::getMidjourneyModes(), true)) {
            $auditCount = 1;
        }

        $imageGenerateAuditBusinessParams = [
            'source_id' => (string) ($data['source_id'] ?? ''),
            'chain' => 'imageGenerate',
        ];
        if ((string) ($data['request_id'] ?? '') !== '') {
            $imageGenerateAuditBusinessParams['request_id'] = (string) $data['request_id'];
        }
        if ((string) ($imageGenerateAuditBusinessParams['request_id'] ?? '') === '') {
            $requestId = CoContext::getRequestId() ?: (string) CoContext::getOrSetRequestId();
            if ($requestId !== '') {
                $imageGenerateAuditBusinessParams['request_id'] = $requestId;
            }
        }

        $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
            userInfo: [
                'organization_code' => $authorization->getOrganizationCode(),
                'user_id' => $authorization->getId(),
                'user_name' => trim($authorization->getRealName() ?: $authorization->getNickname()),
            ],
            ip: RequestHelper::getClientIpFromContainer() ?? '',
            invocationCategory: 'IMAGE',
            productCode: $productCodeForAudit,
            accessToken: '',
            startTime: $startTime,
            latencyMs: $latencyMs,
            outcome: 'success',
            usage: ['count' => $auditCount],
            detailInfo: InvocationDetailInfo::forModel(
                '',
                (string) ($data['source_id'] ?? ''),
                $providerConfigItem->getProviderModelId(),
                null,
                ['chain' => 'imageGenerate']
            ),
            businessParams: $imageGenerateAuditBusinessParams,
            sourceMarker: 'imageGenerate'
        ));

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
        $imageGeneratedEvent->setProviderModelId($providerConfigItem->getProviderModelId());

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
        $providerConfigItem = $miracleVisionServiceProviderConfig->getConfig();

        /**
         * @var MiracleVisionModel $imageGenerateService
         */
        $imageGenerateService = ImageGenerateFactory::create(ImageGenerateModelType::MiracleVision, $miracleVisionServiceProviderConfig->getConfig()->toArray());
        $this->recordImageGenerateMessageLog(ImageGenerateModelType::MiracleVisionHightModelId->value, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

        // 同步等待并返回图片URL
        $startTime = microtime(true);
        $imageUrl = $imageGenerateService->imageConvertHigh(new MiracleVisionModelRequest($url));
        $latencyMs = (int) ((microtime(true) - $startTime) * 1000);

        $imageConvertHighAuditBusinessParams = [
            'source_id' => $reqDTO->getSourceId(),
            'chain' => 'imageConvertHigh',
        ];
        $reqRequestId = (string) ($reqDTO->getRequestId() ?? '');
        if ($reqRequestId !== '') {
            $imageConvertHighAuditBusinessParams['request_id'] = $reqRequestId;
        }
        if ((string) ($imageConvertHighAuditBusinessParams['request_id'] ?? '') === '') {
            $requestId = CoContext::getRequestId() ?: (string) CoContext::getOrSetRequestId();
            if ($requestId !== '') {
                $imageConvertHighAuditBusinessParams['request_id'] = $requestId;
            }
        }

        $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
            userInfo: [
                'organization_code' => $userAuthorization->getOrganizationCode(),
                'user_id' => $userAuthorization->getId(),
                'user_name' => trim($userAuthorization->getRealName() ?: $userAuthorization->getNickname()),
            ],
            ip: RequestHelper::getClientIpFromContainer() ?? '',
            invocationCategory: 'IMAGE',
            productCode: $providerConfigItem->getModelVersion(),
            accessToken: '',
            startTime: $startTime,
            latencyMs: $latencyMs,
            outcome: 'success',
            usage: ['count' => 1],
            detailInfo: InvocationDetailInfo::forModel(
                '',
                $reqDTO->getSourceId(),
                $providerConfigItem->getProviderModelId(),
                null,
                ['chain' => 'imageConvertHigh']
            ),
            businessParams: $imageConvertHighAuditBusinessParams,
            sourceMarker: 'imageConvertHigh'
        ));

        // 审计同步落库后再派发计费事件，异步 worker 消费时便于先存在审计行再回填积分等
        $imageGeneratedEvent = new ImageGeneratedEvent();
        $imageGeneratedEvent->setOrganizationCode($userAuthorization->getOrganizationCode());
        $imageGeneratedEvent->setUserId($userAuthorization->getId());
        $imageGeneratedEvent->setImageCount(1);
        $imageGeneratedEvent->setCreatedAt(new DateTime());
        $imageGeneratedEvent->setModel($providerConfigItem->getModelVersion());
        $imageGeneratedEvent->setProviderModelId($providerConfigItem->getProviderModelId());
        $imageGeneratedEvent->setSourceType($reqDTO->getSourceType());
        $imageGeneratedEvent->setSourceId($reqDTO->getSourceId());
        $imageGeneratedEvent->setProviderModelId($providerConfigItem->getProviderModelId());

        AsyncEventUtil::dispatch($imageGeneratedEvent);

        return $imageUrl;
    }

    /**
     * Bing search proxy with access token authentication.
     *
     * @param string $accessToken Access token for authentication
     * @param string $query Search query
     * @param int $count Number of results (1-50)
     * @param int $offset Pagination offset (0-1000)
     * @param string $mkt Market code (e.g., zh-CN, en-US)
     * @param string $setLang UI language code
     * @param string $safeSearch Safe search level (Strict, Moderate, Off)
     * @param string $freshness Time filter (Day, Week, Month)
     * @param array $businessParams Business parameters for data isolation
     * @return array Native Bing API response
     */
    public function bingSearch(
        string $accessToken,
        string $query,
        int $count = 10,
        int $offset = 0,
        string $mkt = 'zh-CN',
        string $setLang = '',
        string $safeSearch = '',
        string $freshness = '',
        array $businessParams = [],
        array $ips = []
    ): array {
        // 1. Validate access token
        $accessTokenEntity = $this->accessTokenDomainService->getByAccessToken($accessToken);
        if (! $accessTokenEntity) {
            ExceptionBuilder::throw(MagicApiErrorCode::TOKEN_NOT_EXIST);
        }

        // 2. Validate search parameters
        if (empty($query)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'Search query is required');
        }

        if ($count < 1 || $count > 50) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'Count must be between 1 and 50');
        }

        if ($offset < 0 || $offset > 1000) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'Offset must be between 0 and 1000');
        }

        if ((string) ($businessParams['request_id'] ?? '') === '') {
            $requestId = CoContext::getRequestId() ?: (string) CoContext::getOrSetRequestId();
            if ($requestId !== '') {
                $businessParams['request_id'] = $requestId;
            }
        }

        // 3. Create data isolation object (for logging and permission control)
        $modelGatewayDataIsolation = $this->createModelGatewayDataIsolationByAccessToken($accessToken, $businessParams);

        // 4. Log search request
        $this->logger->info('BingSearchRequest', [
            'access_token_id' => $accessTokenEntity->getId(),
            'access_token_name' => $accessTokenEntity->getName(),
            'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
            'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
            'query' => $query,
            'count' => $count,
            'offset' => $offset,
            'mkt' => $mkt,
        ]);

        $startTime = microtime(true);
        try {
            // 5. Get Bing API key from config
            $subscriptionKey = config('search.drivers.bing.api_key');
            if (empty($subscriptionKey)) {
                ExceptionBuilder::throw(MagicApiErrorCode::MODEL_RESPONSE_FAIL, 'Bing Search API key is not configured');
            }

            // 6. Call BingSearch directly for native API response
            $bingSearch = make(BingSearch::class);
            $result = $bingSearch->search(
                $query,
                $subscriptionKey,
                $mkt,
                $count,
                $offset,
                $safeSearch,
                $freshness,
                $setLang
            );

            // 7. Calculate response time
            $responseTime = (int) ((microtime(true) - $startTime) * 1000);

            // 8. Log success
            $this->logger->info('BingSearchSuccess', [
                'access_token_id' => $accessTokenEntity->getId(),
                'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                'query' => $query,
                'result_count' => count($result['webPages']['value'] ?? []),
                'total_matches' => $result['webPages']['totalEstimatedMatches'] ?? 0,
                'response_time' => $responseTime,
            ]);

            // 派发模型调用完成（成功）
            $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
                userInfo: [
                    'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                    'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                    'user_name' => $modelGatewayDataIsolation->getUserName(),
                ],
                ip: implode(',', $ips),
                invocationCategory: 'SEARCH',
                productCode: self::AUDIT_PRODUCT_BING_SEARCH_V1,
                accessToken: $accessToken,
                startTime: $startTime,
                latencyMs: $responseTime,
                outcome: 'success',
                usage: ['count' => 1],
                detailInfo: InvocationDetailInfo::forTool(
                    $modelGatewayDataIsolation->getAppId(),
                    $modelGatewayDataIsolation->getSourceId(),
                    self::AUDIT_PRODUCT_BING_SEARCH_V1,
                    $query
                ),
                businessParams: $businessParams,
                sourceMarker: 'bingSearch'
            ));

            // 9. Return native Bing API format
            return $result;
        } catch (Throwable $e) {
            // Log failure
            $this->logger->error('BingSearchFailed', [
                'access_token_id' => $accessTokenEntity->getId(),
                'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                'query' => $query,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            $failStart = $startTime;
            $failLatency = (int) ((microtime(true) - $failStart) * 1000);

            // 派发模型调用完成（失败）
            $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
                userInfo: [
                    'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                    'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                    'user_name' => $modelGatewayDataIsolation->getUserName(),
                ],
                ip: implode(',', $ips),
                invocationCategory: 'SEARCH',
                productCode: self::AUDIT_PRODUCT_BING_SEARCH_V1,
                accessToken: $accessToken,
                startTime: $failStart,
                latencyMs: $failLatency,
                outcome: 'failure',
                usage: [],
                detailInfo: InvocationDetailInfo::forTool(
                    $modelGatewayDataIsolation->getAppId(),
                    $modelGatewayDataIsolation->getSourceId(),
                    self::AUDIT_PRODUCT_BING_SEARCH_V1,
                    $query
                ),
                businessParams: $businessParams,
                sourceMarker: 'bingSearch'
            ));

            ExceptionBuilder::throw(
                MagicApiErrorCode::MODEL_RESPONSE_FAIL,
                'Bing search failed: ' . $e->getMessage(),
                throwable: $e
            );
        }
    }

    /**
     * Web scrape proxy - returns unified format response.
     *
     * @return array Unified response format
     */
    public function webScrape(WebScrapeRequestDTO $webScrapeRequestDTO): array
    {
        if ((string) ($webScrapeRequestDTO->getBusinessParam('request_id') ?? '') === '') {
            $requestId = CoContext::getRequestId() ?: (string) CoContext::getOrSetRequestId();
            if ($requestId !== '') {
                $webScrapeRequestDTO->addBusinessParam('request_id', $requestId);
            }
        }

        // Create data isolation object
        $modelGatewayDataIsolation = $this->createModelGatewayDataIsolationByAccessToken($webScrapeRequestDTO->getAccessToken(), $webScrapeRequestDTO->getBusinessParams());

        $providerDataIsolation = ProviderDataIsolation::create()->disabled();
        $aiAbilityDomainService = make(AiAbilityDomainService::class);
        $aiAbility = $aiAbilityDomainService->getByCode($providerDataIsolation, AiAbilityCode::WebScrape);

        if (! $aiAbility || ! $aiAbility->isEnabled()) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::AI_ABILITY_NOT_FOUND, 'Web scrape ability is not enabled');
        }

        $config = $aiAbility->getConfig();
        if (empty($config)) {
            ExceptionBuilder::throw(MagicApiErrorCode::MODEL_RESPONSE_FAIL, 'Web scrape configuration is not set');
        }

        $providerConfig = $this->resolveAiAbilityProviderConfig(
            $config['providers'] ?? [],
            $webScrapeRequestDTO->getProvider(),
            'No enabled web scrape provider configuration found'
        );
        $provider = (string) ($providerConfig['provider'] ?? '');

        // Log request
        $this->logger->info('WebScrapeRequest', [
            'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
            'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
            'provider' => $provider,
            'url' => $webScrapeRequestDTO->getUrl(),
            'formats' => $webScrapeRequestDTO->getFormats(),
            'mode' => $webScrapeRequestDTO->getMode(),
        ]);

        $startTime = microtime(true);
        try {
            // Create web scrape instance via factory
            $webScrape = WebScrapeFactory::createByProviderConfig($providerConfig);

            // Execute scrape
            $response = $webScrape->scrape(
                $webScrapeRequestDTO->getUrl(),
                $webScrapeRequestDTO->getFormats(),
                $webScrapeRequestDTO->getMode(),
                $webScrapeRequestDTO->getOptions()
            );

            // Calculate response time
            $responseTime = (int) ((microtime(true) - $startTime) * 1000);

            // Log success
            $this->logger->info('WebScrapeSuccess', [
                'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                'url' => $webScrapeRequestDTO->getUrl(),
                'provider' => $response->getProvider(),
                'response_time' => $responseTime,
            ]);

            // 派发模型调用完成（成功）
            $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
                userInfo: [
                    'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                    'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                    'user_name' => $modelGatewayDataIsolation->getUserName(),
                ],
                ip: implode(',', $webScrapeRequestDTO->getIps()),
                invocationCategory: 'WEB_SCRAPE',
                productCode: $response->getProvider(),
                accessToken: $webScrapeRequestDTO->getAccessToken(),
                startTime: $startTime,
                latencyMs: $responseTime,
                outcome: 'success',
                usage: ['count' => 1],
                detailInfo: InvocationDetailInfo::forTool(
                    $modelGatewayDataIsolation->getAppId(),
                    $modelGatewayDataIsolation->getSourceId(),
                    $response->getProvider(),
                    $webScrapeRequestDTO->getUrl()
                ),
                businessParams: $webScrapeRequestDTO->getBusinessParams(),
                sourceMarker: 'webScrape'
            ));

            // Return unified format
            $result = $response->toArray();
            $result['usage'] = [
                'request_time' => date('c'),
                'duration_ms' => $responseTime,
            ];

            return $result;
        } catch (Throwable $e) {
            // Log failure
            $this->logger->error('WebScrapeFailed', [
                'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                'provider' => $provider,
                'url' => $webScrapeRequestDTO->getUrl(),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            $failStart = $startTime;
            $failLatency = (int) ((microtime(true) - $failStart) * 1000);

            // 派发模型调用完成（失败）
            $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
                userInfo: [
                    'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                    'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                    'user_name' => $modelGatewayDataIsolation->getUserName(),
                ],
                ip: implode(',', $webScrapeRequestDTO->getIps()),
                invocationCategory: 'WEB_SCRAPE',
                productCode: '',
                accessToken: $webScrapeRequestDTO->getAccessToken(),
                startTime: $failStart,
                latencyMs: $failLatency,
                outcome: 'failure',
                usage: [],
                detailInfo: InvocationDetailInfo::forTool(
                    $modelGatewayDataIsolation->getAppId(),
                    $modelGatewayDataIsolation->getSourceId(),
                    '',
                    $webScrapeRequestDTO->getUrl()
                ),
                businessParams: $webScrapeRequestDTO->getBusinessParams(),
                sourceMarker: 'webScrape'
            ));

            ExceptionBuilder::throw(
                MagicApiErrorCode::MODEL_RESPONSE_FAIL,
                'Web scrape failed: ' . $e->getMessage(),
                throwable: $e
            );
        }
    }

    /**
     * Unified search proxy - supports multiple search engines with unified response format.
     *
     * @param SearchRequestDTO $searchRequestDTO Search request DTO with unified parameters
     * @return SearchResponseDTO Unified Bing-compatible format response
     */
    public function unifiedSearch(SearchRequestDTO $searchRequestDTO): SearchResponseDTO
    {
        // Validate search parameters
        $searchRequestDTO->validate();
        if ((string) ($searchRequestDTO->getBusinessParam('request_id') ?? '') === '') {
            $requestId = CoContext::getRequestId() ?: (string) CoContext::getOrSetRequestId();
            if ($requestId !== '') {
                $searchRequestDTO->addBusinessParam('request_id', $requestId);
            }
        }
        $businessParams = $searchRequestDTO->getBusinessParams();

        // Create data isolation object (for logging and permission control)
        $modelGatewayDataIsolation = $this->createModelGatewayDataIsolationByAccessToken($searchRequestDTO->getAccessToken(), $businessParams);

        // Get web_search ability configuration
        $aiAbilityDomainService = di(AiAbilityDomainService::class);

        $dataIsolation = ProviderDataIsolation::create()->disabled();
        $aiAbilityEntity = $aiAbilityDomainService->getByCode($dataIsolation, AiAbilityCode::WebSearch);

        // Check if ability is enabled
        if (! $aiAbilityEntity || $aiAbilityEntity->getStatus() !== Status::Enabled) {
            ExceptionBuilder::throw(
                MagicApiErrorCode::MODEL_RESPONSE_FAIL,
                'Web search ability is disabled'
            );
        }

        $enabledConfig = $this->resolveAiAbilityProviderConfig(
            $aiAbilityEntity->getConfig()['providers'] ?? [],
            $searchRequestDTO->getProvider(),
            'No enabled search engine configuration found'
        );

        $provider = $enabledConfig['provider'] ?? null;

        // 7. Log search request
        $this->logger->info('UnifiedSearchRequest', [
            'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
            'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
            'provider' => $provider,
            'query' => $searchRequestDTO->getQuery(),
            'count' => $searchRequestDTO->getCount(),
            'offset' => $searchRequestDTO->getOffset(),
            'mkt' => $searchRequestDTO->getMkt(),
        ]);

        $startTime = microtime(true);
        $adapter = null;
        try {
            // 8. Create adapter using factory
            $factory = make(SearchEngineAdapterFactory::class);
            $adapter = $factory->create($provider, $enabledConfig);

            // 9. Check engine availability
            if (! $adapter->isAvailable()) {
                ExceptionBuilder::throw(
                    MagicApiErrorCode::MODEL_RESPONSE_FAIL,
                    "Search engine '{$adapter->getEngineName()}' is not available (API key not configured or service unavailable)"
                );
            }

            $businessParams['call_time'] = date('Y-m-d H:i:s');
            // Execute search with unified parameters - adapter returns unified format
            $unifiedResponse = $adapter->search(
                $searchRequestDTO->getQuery(),
                $searchRequestDTO->getMkt(),
                $searchRequestDTO->getCount(),
                $searchRequestDTO->getOffset(),
                $searchRequestDTO->getSafeSearch(),
                $searchRequestDTO->getFreshness(),
                $searchRequestDTO->getSetLang()
            );

            // Calculate response time
            $responseTime = (int) ((microtime(true) - $startTime) * 1000);

            // Add metadata to response
            $unifiedResponse->setMetadata([
                'engine' => $adapter->getEngineName(),
                'responseTime' => $responseTime,
                'query' => $searchRequestDTO->getQuery(),
                'count' => $searchRequestDTO->getCount(),
                'offset' => $searchRequestDTO->getOffset(),
            ]);

            // 派发模型调用完成（成功）
            $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
                userInfo: [
                    'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                    'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                    'user_name' => $modelGatewayDataIsolation->getUserName(),
                ],
                ip: implode(',', $searchRequestDTO->getIps()),
                invocationCategory: 'SEARCH',
                productCode: $adapter->getEngineName(),
                accessToken: $searchRequestDTO->getAccessToken(),
                startTime: $startTime,
                latencyMs: $responseTime,
                outcome: 'success',
                usage: ['count' => 1],
                detailInfo: InvocationDetailInfo::forTool(
                    $modelGatewayDataIsolation->getAppId(),
                    $modelGatewayDataIsolation->getSourceId(),
                    $adapter->getEngineName(),
                    $searchRequestDTO->getQuery()
                ),
                businessParams: $searchRequestDTO->getBusinessParams(),
                sourceMarker: 'unifiedSearch'
            ));

            $businessParams['response_duration'] = $responseTime;
            $businessParams['source_id'] = $modelGatewayDataIsolation->getSourceId();
            $businessParams['access_token_id'] = $modelGatewayDataIsolation->getAccessToken()->getId();
            $businessParams['access_token_name'] = $modelGatewayDataIsolation->getAccessToken()->getName();
            $webSearchUsageEvent = new WebSearchUsageEvent(
                $adapter->getEngineName(),
                $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                $modelGatewayDataIsolation->getCurrentUserId(),
                $businessParams
            );
            AsyncEventUtil::dispatch($webSearchUsageEvent);

            // Log success
            $webPages = $unifiedResponse->getWebPages();
            $this->logger->info('UnifiedSearchSuccess', [
                'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                'engine' => $adapter->getEngineName(),
                'query' => $searchRequestDTO->getQuery(),
                'result_count' => $webPages ? count($webPages->getValue()) : 0,
                'total_matches' => $webPages ? $webPages->getTotalEstimatedMatches() : 0,
                'response_time' => $responseTime,
            ]);

            // Return unified response (Bing-compatible format)
            return $unifiedResponse;
        } catch (BusinessException $e) {
            // Re-throw business exceptions
            throw $e;
        } catch (Throwable $e) {
            // Log failure
            $this->logger->error('UnifiedSearchFailed', [
                'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                'provider' => $provider ?? 'unknown',
                'query' => $searchRequestDTO->getQuery(),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            $failLatency = (int) ((microtime(true) - $startTime) * 1000);
            $failProductCode = $adapter?->getEngineName() ?? '';

            // 派发模型调用完成（失败）
            $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
                userInfo: [
                    'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                    'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                    'user_name' => $modelGatewayDataIsolation->getUserName(),
                ],
                ip: implode(',', $searchRequestDTO->getIps()),
                invocationCategory: 'SEARCH',
                productCode: $failProductCode,
                accessToken: $searchRequestDTO->getAccessToken(),
                startTime: $startTime,
                latencyMs: $failLatency,
                outcome: 'failure',
                usage: [],
                detailInfo: InvocationDetailInfo::forTool(
                    $modelGatewayDataIsolation->getAppId(),
                    $modelGatewayDataIsolation->getSourceId(),
                    $failProductCode,
                    $searchRequestDTO->getQuery()
                ),
                businessParams: $searchRequestDTO->getBusinessParams(),
                sourceMarker: 'unifiedSearch'
            ));

            ExceptionBuilder::throw(
                MagicApiErrorCode::MODEL_RESPONSE_FAIL,
                'Unified search failed: ' . $e->getMessage(),
                throwable: $e
            );
        }
    }

    /**
     * Image search proxy - supports multiple providers (Bing, Google via SerpApi).
     *
     * @param ImageSearchRequestDTO $imageSearchRequestDTO Image search request DTO with unified parameters
     * @return ImageSearchResponseDTO Unified image search response
     */
    public function imageSearch(ImageSearchRequestDTO $imageSearchRequestDTO): ImageSearchResponseDTO
    {
        // Validate search parameters
        $imageSearchRequestDTO->validate();
        if ((string) ($imageSearchRequestDTO->getBusinessParam('request_id') ?? '') === '') {
            $requestId = CoContext::getRequestId() ?: (string) CoContext::getOrSetRequestId();
            if ($requestId !== '') {
                $imageSearchRequestDTO->addBusinessParam('request_id', $requestId);
            }
        }
        $businessParams = $imageSearchRequestDTO->getBusinessParams();

        // Create data isolation object (for logging and permission control)
        $modelGatewayDataIsolation = $this->createModelGatewayDataIsolationByAccessToken($imageSearchRequestDTO->getAccessToken(), $businessParams);

        // Get image_search ability configuration
        $aiAbilityDomainService = di(AiAbilityDomainService::class);

        $dataIsolation = ProviderDataIsolation::create()->disabled();
        $aiAbilityEntity = $aiAbilityDomainService->getByCode($dataIsolation, AiAbilityCode::ImageSearch);

        // Check if ability is enabled
        if (! $aiAbilityEntity || $aiAbilityEntity->getStatus() !== Status::Enabled) {
            ExceptionBuilder::throw(
                MagicApiErrorCode::MODEL_RESPONSE_FAIL,
                'Image search ability is disabled'
            );
        }

        $enabledConfig = $this->resolveAiAbilityProviderConfig(
            $aiAbilityEntity->getConfig()['providers'] ?? [],
            $imageSearchRequestDTO->getProvider(),
            'No enabled image search provider configuration found'
        );

        $provider = $enabledConfig['provider'] ?? null;

        // Log search request
        $this->logger->info('ImageSearchRequest', [
            'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
            'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
            'provider' => $provider,
            'query' => $imageSearchRequestDTO->getQuery(),
            'count' => $imageSearchRequestDTO->getCount(),
            'offset' => $imageSearchRequestDTO->getOffset(),
        ]);

        $startTime = microtime(true);
        $adapter = null;
        try {
            // Create adapter using factory
            $factory = make(ImageSearchEngineAdapterFactory::class);
            $adapter = $factory->create($provider, $enabledConfig);

            // Check engine availability
            if (! $adapter->isAvailable()) {
                ExceptionBuilder::throw(
                    MagicApiErrorCode::MODEL_RESPONSE_FAIL,
                    "Image search provider '{$adapter->getEngineName()}' is not available (API key not configured or service unavailable)"
                );
            }

            // Execute search with unified parameters - adapter returns unified format
            $unifiedResponse = $adapter->imageSearch(
                $imageSearchRequestDTO->getQuery(),
                $imageSearchRequestDTO->getCount(),
                $imageSearchRequestDTO->getOffset()
            );

            // Calculate response time
            $responseTime = (int) ((microtime(true) - $startTime) * 1000);

            // Add metadata to response
            $unifiedResponse->setMetadata([
                'engine' => $adapter->getEngineName(),
                'responseTime' => $responseTime,
                'query' => $imageSearchRequestDTO->getQuery(),
                'count' => $imageSearchRequestDTO->getCount(),
                'offset' => $imageSearchRequestDTO->getOffset(),
            ]);

            // 派发模型调用完成（成功）
            $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
                userInfo: [
                    'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                    'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                    'user_name' => $modelGatewayDataIsolation->getUserName(),
                ],
                ip: implode(',', $imageSearchRequestDTO->getIps()),
                invocationCategory: 'SEARCH',
                productCode: $adapter->getEngineName(),
                accessToken: $imageSearchRequestDTO->getAccessToken(),
                startTime: $startTime,
                latencyMs: $responseTime,
                outcome: 'success',
                usage: ['count' => 1],
                detailInfo: InvocationDetailInfo::forTool(
                    $modelGatewayDataIsolation->getAppId(),
                    $modelGatewayDataIsolation->getSourceId(),
                    $adapter->getEngineName(),
                    $imageSearchRequestDTO->getQuery()
                ),
                businessParams: $imageSearchRequestDTO->getBusinessParams(),
                sourceMarker: 'imageSearch'
            ));

            $businessParams['response_duration'] = $responseTime;
            $businessParams['call_time'] = date('Y-m-d H:i:s');
            $businessParams['source_id'] = $modelGatewayDataIsolation->getSourceId();
            $businessParams['access_token_id'] = $modelGatewayDataIsolation->getAccessToken()->getId();
            $businessParams['access_token_name'] = $modelGatewayDataIsolation->getAccessToken()->getName();
            $imageSearchUsageEvent = new ImageSearchUsageEvent(
                $adapter->getEngineName(),
                $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                $modelGatewayDataIsolation->getCurrentUserId(),
                $businessParams
            );
            AsyncEventUtil::dispatch($imageSearchUsageEvent);

            // Log success
            $images = $unifiedResponse->getImages();
            $this->logger->info('ImageSearchSuccess', [
                'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                'engine' => $adapter->getEngineName(),
                'query' => $imageSearchRequestDTO->getQuery(),
                'result_count' => $images ? count($images->getValue()) : 0,
                'total_matches' => $images ? $images->getTotalEstimatedMatches() : 0,
                'response_time' => $responseTime,
            ]);

            // Return unified response
            return $unifiedResponse;
        } catch (BusinessException $e) {
            // Re-throw business exceptions
            throw $e;
        } catch (Throwable $e) {
            // Log failure
            $this->logger->error('ImageSearchFailed', [
                'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                'provider' => $provider ?? 'unknown',
                'query' => $imageSearchRequestDTO->getQuery(),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            $failLatency = (int) ((microtime(true) - $startTime) * 1000);
            $failProductCode = $adapter?->getEngineName() ?? '';

            // 派发模型调用完成（失败）
            $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
                userInfo: [
                    'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                    'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                    'user_name' => $modelGatewayDataIsolation->getUserName(),
                ],
                ip: implode(',', $imageSearchRequestDTO->getIps()),
                invocationCategory: 'SEARCH',
                productCode: $failProductCode,
                accessToken: $imageSearchRequestDTO->getAccessToken(),
                startTime: $startTime,
                latencyMs: $failLatency,
                outcome: 'failure',
                usage: [],
                detailInfo: InvocationDetailInfo::forTool(
                    $modelGatewayDataIsolation->getAppId(),
                    $modelGatewayDataIsolation->getSourceId(),
                    $failProductCode,
                    $imageSearchRequestDTO->getQuery()
                ),
                businessParams: $imageSearchRequestDTO->getBusinessParams(),
                sourceMarker: 'imageSearch'
            ));

            ExceptionBuilder::throw(
                MagicApiErrorCode::MODEL_RESPONSE_FAIL,
                'Image search failed: ' . $e->getMessage(),
                throwable: $e
            );
        }
    }

    public function textGenerateImage(TextGenerateImageDTO $textGenerateImageDTO): array
    {
        $accessTokenEntity = $this->validateAccessToken($textGenerateImageDTO);

        $dataIsolation = LLMDataIsolation::create()->disabled();

        $contextData = $this->parseBusinessContext($dataIsolation, $accessTokenEntity, $textGenerateImageDTO);
        $organizationCode = $contextData['organization_code'];
        $creator = $contextData['user_id'];

        $modelId = $textGenerateImageDTO->getModel();

        $modelGatewayDataIsolation = $this->createModelGatewayDataIsolationByAccessToken($textGenerateImageDTO->getAccessToken(), $textGenerateImageDTO->getBusinessParams());
        $imageModel = $this->modelGatewayMapper->getOrganizationImageModel($modelGatewayDataIsolation, $modelId)?->getImageModel();

        if (empty($imageModel)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
        }

        $imageGenerateType = ImageGenerateModelType::fromProviderCode($imageModel->getProviderCode(), $imageModel->getModelVersion());

        $imageGenerateParamsVO = new AIImageGenerateParamsVO();
        $imageGenerateParamsVO->setModel($imageModel->getModelVersion());
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

        $data = $imageGenerateParamsVO->toArray();
        $data['organization_code'] = $organizationCode;

        $imageGenerateRequest = ImageGenerateFactory::createRequestType($imageGenerateType, $imageModel->getModelVersion(), $modelId, $data);

        $imageGenerateRequest->setWatermarkConfig($textGenerateImageDTO->getWatermark());

        $implicitWatermark = new ImplicitWatermark();
        $implicitWatermark->setOrganizationCode($organizationCode)
            ->setUserId($creator)
            ->setTopicId($textGenerateImageDTO->getTopicId());

        $imageGenerateRequest->setImplicitWatermark($implicitWatermark);
        $imageGenerateRequest->setValidityPeriod(1);

        $errorMessage = '';
        // 记录调用时间
        $callTime = date('Y-m-d H:i:s');
        $startTime = microtime(true);

        if ((string) ($textGenerateImageDTO->getBusinessParam('request_id') ?? '') === '') {
            $requestId = CoContext::getRequestId() ?: (string) CoContext::getOrSetRequestId();
            if ($requestId !== '') {
                $textGenerateImageDTO->addBusinessParam('request_id', $requestId);
            }
        }

        $imageGenerateService = ImageGenerateFactory::create($imageGenerateType, $imageModel->getConfig());
        try {
            $imageGenerateRequest->setModel($imageModel->getModelVersion());
            $generateImageRaw = $imageGenerateService->generateImageRawWithWatermark($imageGenerateRequest);
            if (! empty($generateImageRaw)) {
                $this->recordImageGenerateMessageLog($imageModel->getModelVersion(), $creator, $organizationCode);
                $n = $textGenerateImageDTO->getN();
                // 除了 mj 是 1 次之外，其他都按张数算
                if (in_array($imageModel->getModelVersion(), ImageGenerateModelType::getMidjourneyModes())) {
                    $n = 1;
                }

                $latencyMs = (int) ((microtime(true) - $startTime) * 1000);
                $auditCount = $textGenerateImageDTO->getN();
                if (in_array($imageModel->getModelVersion(), ImageGenerateModelType::getMidjourneyModes(), true)) {
                    $auditCount = 1;
                }

                // 派发模型调用完成（成功）
                $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
                    userInfo: [
                        'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                        'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                        'user_name' => $modelGatewayDataIsolation->getUserName(),
                    ],
                    ip: implode(',', $textGenerateImageDTO->getIps()),
                    invocationCategory: 'IMAGE',
                    productCode: $modelId,
                    accessToken: $textGenerateImageDTO->getAccessToken(),
                    startTime: $startTime,
                    latencyMs: $latencyMs,
                    outcome: 'success',
                    usage: ['count' => $auditCount],
                    detailInfo: InvocationDetailInfo::forModel(
                        $modelGatewayDataIsolation->getAppId(),
                        $modelGatewayDataIsolation->getSourceId(),
                        $imageModel->getProviderModelId(),
                        null,
                        ['chain' => 'textGenerateImage']
                    ),
                    businessParams: $textGenerateImageDTO->getBusinessParams(),
                    sourceMarker: 'textGenerateImage'
                ));

                $this->dispatchImageGeneratedEvent(
                    $creator,
                    $organizationCode,
                    $textGenerateImageDTO,
                    $n,
                    $imageModel->getProviderModelId(),
                    $callTime,
                    $startTime,
                    $accessTokenEntity
                );

                return $generateImageRaw;
            }
        } catch (Exception $e) {
            $errorMessage = $e->getMessage();
            $this->logger->warning('text generate image error:' . $e->getMessage());
        }

        $latencyMs = (int) ((microtime(true) - $startTime) * 1000);

        // 派发模型调用完成（失败）
        $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
            userInfo: [
                'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                'user_name' => $modelGatewayDataIsolation->getUserName(),
            ],
            ip: implode(',', $textGenerateImageDTO->getIps()),
            invocationCategory: 'IMAGE',
            productCode: $modelId,
            accessToken: $textGenerateImageDTO->getAccessToken(),
            startTime: $startTime,
            latencyMs: $latencyMs,
            outcome: 'failure',
            usage: [],
            detailInfo: InvocationDetailInfo::forModel(
                $modelGatewayDataIsolation->getAppId(),
                $modelGatewayDataIsolation->getSourceId(),
                $imageModel->getProviderModelId(),
                null,
                ['chain' => 'textGenerateImage']
            ),
            businessParams: $textGenerateImageDTO->getBusinessParams(),
            sourceMarker: 'textGenerateImage'
        ));

        ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $errorMessage);
    }

    /**
     * Image editing with uploaded files using volcano image generation models.
     */
    public function imageEdit(ImageEditDTO $imageEditDTO): array
    {
        $accessTokenEntity = $this->validateAccessToken($imageEditDTO);

        if ((string) ($imageEditDTO->getBusinessParam('request_id') ?? '') === '') {
            $requestId = CoContext::getRequestId() ?: (string) CoContext::getOrSetRequestId();
            if ($requestId !== '') {
                $imageEditDTO->addBusinessParam('request_id', $requestId);
            }
        }

        $dataIsolation = LLMDataIsolation::create()->disabled();

        $contextData = $this->parseBusinessContext($dataIsolation, $accessTokenEntity, $imageEditDTO);
        $organizationCode = $contextData['organization_code'];
        $creator = $contextData['user_id'];

        $modelId = $imageEditDTO->getModel();

        $modelGatewayDataIsolation = $this->createModelGatewayDataIsolationByAccessToken($imageEditDTO->getAccessToken(), $imageEditDTO->getBusinessParams());
        $imageModel = $this->modelGatewayMapper->getOrganizationImageModel($modelGatewayDataIsolation, $modelId)?->getImageModel();

        if (empty($imageModel)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
        }

        $imageGenerateType = ImageGenerateModelType::fromProviderCode($imageModel->getProviderCode(), $imageModel->getModelVersion());

        $imageGenerateParamsVO = new AIImageGenerateParamsVO();
        $imageGenerateParamsVO->setModel($imageModel->getModelVersion());
        $imageGenerateParamsVO->setUserPrompt($imageEditDTO->getPrompt());
        $imageGenerateParamsVO->setReferenceImages($imageEditDTO->getImages());
        $data = $imageGenerateParamsVO->toArray();
        $data['organization_code'] = $organizationCode;

        $imageGenerateRequest = ImageGenerateFactory::createRequestType($imageGenerateType, $imageModel->getModelVersion(), $modelId, $data);

        // 添加水印
        $watermark = di(WatermarkPolicyInterface::class)->apply($accessTokenEntity);
        $imageGenerateRequest->setWatermarkConfig($watermark);

        $imageGenerateRequest->setGenerateNum(1); // 图生图默认只能 1
        $implicitWatermark = new ImplicitWatermark();
        $imageGenerateRequest->setGenerateNum(1); // 图生图默认只能 1
        $implicitWatermark->setOrganizationCode($organizationCode)
            ->setUserId($creator)
            ->setTopicId($imageEditDTO->getTopicId());

        $imageGenerateRequest->setImplicitWatermark($implicitWatermark);
        $size = $imageEditDTO->getSize();

        [$width, $height] = explode('x', $size);

        // 计算字符串格式的比例，如 "1:1", "3:4"
        $imageGenerateRequest->setWidth($width);
        $imageGenerateRequest->setHeight($height);

        // 记录调用时间
        $callTime = date('Y-m-d H:i:s');
        $startTime = microtime(true);
        $imageGenerateService = ImageGenerateFactory::create($imageGenerateType, $imageModel->getConfig());
        try {
            $imageGenerateRequest->setModel($imageModel->getModelVersion());
            $generateImageRaw = $imageGenerateService->generateImageRawWithWatermark($imageGenerateRequest);
            if (! empty($generateImageRaw)) {
                $latencyMs = (int) ((microtime(true) - $startTime) * 1000);

                // 派发模型调用完成（成功）
                $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
                    userInfo: [
                        'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                        'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                        'user_name' => $modelGatewayDataIsolation->getUserName(),
                    ],
                    ip: implode(',', $imageEditDTO->getIps()),
                    invocationCategory: 'IMAGE',
                    productCode: $modelId,
                    accessToken: $imageEditDTO->getAccessToken(),
                    startTime: $startTime,
                    latencyMs: $latencyMs,
                    outcome: 'success',
                    usage: ['count' => 1],
                    detailInfo: InvocationDetailInfo::forModel(
                        $modelGatewayDataIsolation->getAppId(),
                        $modelGatewayDataIsolation->getSourceId(),
                        $imageModel->getProviderModelId(),
                        null,
                        ['chain' => 'imageEdit']
                    ),
                    businessParams: $imageEditDTO->getBusinessParams(),
                    sourceMarker: 'imageEdit'
                ));

                // 统一触发事件（图生图默认 1 张）
                $this->dispatchImageGeneratedEvent(
                    $creator,
                    $organizationCode,
                    $imageEditDTO,
                    1,
                    $imageModel->getProviderModelId(),
                    $callTime,
                    $startTime,
                    $accessTokenEntity
                );

                return $generateImageRaw;
            }
        } catch (Exception $e) {
            $this->logger->warning('text generate image error:' . $e->getMessage());
        }

        $latencyMs = (int) ((microtime(true) - $startTime) * 1000);

        // 派发模型调用完成（失败）
        $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
            userInfo: [
                'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                'user_name' => $modelGatewayDataIsolation->getUserName(),
            ],
            ip: implode(',', $imageEditDTO->getIps()),
            invocationCategory: 'IMAGE',
            productCode: $modelId,
            accessToken: $imageEditDTO->getAccessToken(),
            startTime: $startTime,
            latencyMs: $latencyMs,
            outcome: 'failure',
            usage: [],
            detailInfo: InvocationDetailInfo::forModel(
                $modelGatewayDataIsolation->getAppId(),
                $modelGatewayDataIsolation->getSourceId(),
                $imageModel->getProviderModelId(),
                null,
                ['chain' => 'imageEdit']
            ),
            businessParams: $imageEditDTO->getBusinessParams(),
            sourceMarker: 'imageEdit'
        ));

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
    protected function processRequest(ProxyModelRequestInterface $proxyModelRequest, callable $modelCallFunction): ResponseInterface
    {
        /** @var null|EndpointDTO $endpointDTO */
        $endpointDTO = null;
        $modelGatewayDataIsolation = null;
        $modelAttributes = null;
        $originalModelId = $proxyModelRequest->getModel();
        try {
            // Validate access token and model permissions
            $modelGatewayDataIsolation = $this->createModelGatewayDataIsolationByAccessToken($proxyModelRequest->getAccessToken(), $proxyModelRequest->getBusinessParams());

            $this->pointComponent->checkPointsSufficient(
                $proxyModelRequest,
                $modelGatewayDataIsolation
            );

            // Try to get high availability model configuration
            $orgCode = $modelGatewayDataIsolation->getCurrentOrganizationCode();

            // 检查是否为动态模型
            $modeId = $this->aggregateModelResolverService->resolve($originalModelId, $modelGatewayDataIsolation);

            // 设置原始 model_id（目前用于识别是否动态模型）.
            if ($proxyModelRequest instanceof AbstractRequestDTO) {
                $proxyModelRequest->setModel($modeId);
                $proxyModelRequest->setOriginalModelId($originalModelId);
            }

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

            try {
                $model = match ($proxyModelRequest->getType()) {
                    'chat' => $this->modelGatewayMapper->getOrganizationChatModel($modelGatewayDataIsolation, $modeId),
                    'embedding' => $this->modelGatewayMapper->getOrganizationEmbeddingModel($modelGatewayDataIsolation, $modeId),
                    'image' => $this->modelGatewayMapper->getOrganizationImageModel($modelGatewayDataIsolation, $modeId),
                    'video' => $this->modelGatewayMapper->getOrganizationVideoModel($modelGatewayDataIsolation, $modeId),
                    default => null
                };
                if ($model instanceof ModelEntry) {
                    $modelAttributes = $model->getAttributes();
                    $impl = $model->getModel();
                    $model = $impl instanceof OdinModel ? $impl->getModel() : $impl;
                }
                // Try to use model_name to get real data again
                if ($model instanceof MagicAILocalModel) {
                    $modelId = $model->getModelName();
                    $model = match ($proxyModelRequest->getType()) {
                        'chat' => $this->modelGatewayMapper->getOrganizationChatModel($modelGatewayDataIsolation, $modelId),
                        'embedding' => $this->modelGatewayMapper->getOrganizationEmbeddingModel($modelGatewayDataIsolation, $modelId),
                        default => null
                    };
                    if ($model instanceof ModelEntry) {
                        $modelAttributes = $model->getAttributes();
                        $impl = $model->getModel();
                        $model = $impl instanceof OdinModel ? $impl->getModel() : $impl;
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
            if ($proxyModelRequest instanceof CompletionDTO && $model instanceof AbstractModel) {
                if ($proxyModelRequest->getMaxTokens() === -1) {
                    $proxyModelRequest->setMaxTokens($model->getModelOptions()->getMaxOutputTokens());
                }
            }
            if (! empty($modelGatewayDataIsolation->getBusinessId()) && empty($proxyModelRequest->getBusinessParam('business_id'))) {
                $proxyModelRequest->addBusinessParam('business_id', $modelGatewayDataIsolation->getBusinessId());
            }

            $proxyModelRequest->addBusinessParam('model_id', $proxyModelRequest->getModel());
            $proxyModelRequest->addBusinessParam('app_id', $modelGatewayDataIsolation->getAppId());
            $proxyModelRequest->addBusinessParam('service_provider_id', $modelAttributes?->getProviderId() ?? '');
            $proxyModelRequest->addBusinessParam('service_provider_model_id', $modelAttributes?->getProviderModelId() ?? '');
            $proxyModelRequest->addBusinessParam('model_name', $modelAttributes?->getLabel() ?? '');
            $proxyModelRequest->addBusinessParam('source_id', $modelGatewayDataIsolation->getSourceId());
            $proxyModelRequest->addBusinessParam('user_name', $modelGatewayDataIsolation->getUserName());
            $proxyModelRequest->addBusinessParam('organization_id', $modelGatewayDataIsolation->getCurrentOrganizationCode());
            $proxyModelRequest->addBusinessParam('user_id', $modelGatewayDataIsolation->getCurrentUserId());
            $proxyModelRequest->addBusinessParam('access_token_id', $modelGatewayDataIsolation->getAccessToken()->getId());
            $proxyModelRequest->addBusinessParam('access_token_name', $modelGatewayDataIsolation->getAccessToken()->getName());
            $proxyModelRequest->addBusinessParam('access_token_type', $modelGatewayDataIsolation->getAccessToken()->getType()->value);
            $proxyModelRequest->addBusinessParam('call_time', date('Y-m-d H:i:s'));
            $proxyModelRequest->addBusinessParam('original_model_id', $originalModelId);

            if ((string) ($proxyModelRequest->getBusinessParam('request_id') ?? '') === '') {
                $requestId = CoContext::getRequestId() ?: (string) CoContext::getOrSetRequestId();
                if ($requestId !== '') {
                    $proxyModelRequest->addBusinessParam('request_id', $requestId);
                }
            }

            // Call LLM model to get response
            /** @var ResponseInterface $response */
            $response = $modelCallFunction($modelGatewayDataIsolation, $model, $proxyModelRequest);

            // Calculate response time (milliseconds)
            $responseTime = (int) ((microtime(true) - $startTime) * 1000);

            $usageData = [
                'tokens' => $response->getUsage()?->getTotalTokens() ?? 0,
                'amount' => 0, // todo billing system
            ];

            $this->logger->info('ModelCallSuccess', [
                'model' => $proxyModelRequest->getModel(),
                'access_token_id' => $modelGatewayDataIsolation->getAccessToken()->getId(),
                'access_token_type' => $modelGatewayDataIsolation->getAccessToken()->getType()->value,
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

            $detailExtras = ['original_model_id' => $originalModelId];

            // 派发模型调用完成（成功）；流式首包后同步落库事实，最终 usage 仍由 AuditLogSubscriber 在 AfterChatCompletionsStreamEvent 回填
            $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
                userInfo: [
                    'organization_code' => $modelGatewayDataIsolation->getCurrentOrganizationCode(),
                    'user_id' => $modelGatewayDataIsolation->getCurrentUserId(),
                    'user_name' => $modelGatewayDataIsolation->getUserName(),
                ],
                ip: implode(',', $proxyModelRequest->getIps()),
                invocationCategory: $this->resolveInvocationCategory($proxyModelRequest->getType()),
                productCode: $proxyModelRequest->getModel(),
                accessToken: $proxyModelRequest->getAccessToken(),
                startTime: $startTime,
                latencyMs: $responseTime,
                outcome: 'success',
                usage: $response->getUsage()?->toArray() ?? [],
                detailInfo: InvocationDetailInfo::forModel(
                    $modelGatewayDataIsolation->getAppId(),
                    $modelGatewayDataIsolation->getSourceId(),
                    $modelAttributes?->getProviderModelId() ?? '',
                    $proxyModelRequest instanceof CompletionDTO ? $proxyModelRequest->isStream() : null,
                    $detailExtras
                ),
                businessParams: $proxyModelRequest->getBusinessParams(),
                sourceMarker: 'processRequest'
            ));

            return $response;
        } catch (Throwable $throwable) {
            $this->handleRequestException($endpointDTO, $startTime ?? microtime(true), $proxyModelRequest, $throwable, 500);

            $failStart = $startTime ?? microtime(true);
            $failLatency = (int) ((microtime(true) - $failStart) * 1000);

            // 派发模型调用完成（失败）
            $this->dispatchModelInvocationCompleted(new ModelInvocationCompletedEvent(
                userInfo: [
                    'organization_code' => $modelGatewayDataIsolation?->getCurrentOrganizationCode() ?? '',
                    'user_id' => $modelGatewayDataIsolation?->getCurrentUserId() ?? '',
                    'user_name' => $modelGatewayDataIsolation?->getUserName() ?? '',
                ],
                ip: implode(',', $proxyModelRequest->getIps()),
                invocationCategory: $this->resolveInvocationCategory($proxyModelRequest->getType()),
                productCode: $proxyModelRequest->getModel(),
                accessToken: $proxyModelRequest->getAccessToken(),
                startTime: $failStart,
                latencyMs: $failLatency,
                outcome: 'failure',
                usage: [],
                detailInfo: InvocationDetailInfo::forModel(
                    $modelGatewayDataIsolation?->getAppId() ?? '',
                    $modelGatewayDataIsolation?->getSourceId() ?? '',
                    $modelAttributes?->getProviderModelId() ?? '',
                    $proxyModelRequest instanceof CompletionDTO ? $proxyModelRequest->isStream() : null,
                    [
                        'original_model_id' => $originalModelId,
                        'error_code' => $throwable->getCode(),
                    ]
                ),
                businessParams: $proxyModelRequest->getBusinessParams(),
                sourceMarker: 'processRequest'
            ));

            $message = '';
            if ($throwable instanceof OdinException || $throwable instanceof InvalidArgumentException || $throwable instanceof BusinessException) {
                $message = $throwable->getMessage();
            }
            $businessParams = $proxyModelRequest->getBusinessParams();
            $businessParams['is_success'] = false;
            $businessParams['error_code'] = $throwable->getCode();
            $chatUsageEvent = new ModelUsageEvent(
                modelType: $proxyModelRequest->getType(),
                modelId: $proxyModelRequest->getModel(),
                modelVersion: $proxyModelRequest->getModel(),
                usage: new Usage(0, 0, 0),
                organizationCode: $modelGatewayDataIsolation?->getCurrentOrganizationCode() ?? '',
                userId: $modelGatewayDataIsolation?->getCurrentUserId() ?? '',
                appId: $modelGatewayDataIsolation?->getAppId() ?? '',
                serviceProviderModelId: $modelAttributes?->getProviderModelId() ?? '',
                businessParams: $businessParams,
            );

            AsyncEventUtil::dispatch($chatUsageEvent);
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
     * 请求类型 → 调用类别（TEXT / EMBEDDING / IMAGE，字符串与现网审计分类取值一致）.
     */
    protected function resolveInvocationCategory(string $requestType): string
    {
        return match ($requestType) {
            'chat' => 'TEXT',
            'embedding' => 'EMBEDDING',
            'image' => 'IMAGE',
            default => 'TEXT',
        };
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
    protected function callImageModel(ModelGatewayDataIsolation $modelGatewayDataIsolation, ImageModel $imageModel, TextGenerateImageDTO $proxyModelRequest): OpenAIFormatResponse
    {
        // 记录调用时间
        $callTime = date('Y-m-d H:i:s');
        $startTime = microtime(true);

        $organizationCode = $modelGatewayDataIsolation->getCurrentOrganizationCode();
        $creator = $modelGatewayDataIsolation->getCurrentUserId();

        $modelVersion = $imageModel->getModelVersion();
        $imageGenerateType = ImageGenerateModelType::fromProviderCode($imageModel->getProviderCode(), $modelVersion);
        $this->logger->info('match image type', ['model_version' => $modelVersion, 'provider_code' => $imageModel->getProviderCode(), 'image_type' => $imageGenerateType]);

        // 构建图片生成参数
        $imageGenerateParamsVO = new AIImageGenerateParamsVO();
        $imageGenerateParamsVO->setModel($modelVersion);
        $imageGenerateParamsVO->setUserPrompt($proxyModelRequest->getPrompt());
        $imageGenerateParamsVO->setGenerateNum($proxyModelRequest->getN());
        $imageGenerateParamsVO->setSequentialImageGeneration($proxyModelRequest->getSequentialImageGeneration());
        $imageGenerateParamsVO->setSequentialImageGenerationOptions($proxyModelRequest->getSequentialImageGenerationOptions());
        $imageGenerateParamsVO->setReferenceImages($proxyModelRequest->getImages());

        // 直接透传原始 size 参数，让各服务商根据自己的需求处理
        $imageGenerateParamsVO->setSize($proxyModelRequest->getSize(''));

        $data = $imageGenerateParamsVO->toArray();
        $data['organization_code'] = $organizationCode;

        // 图片水印处理
        $imageGenerateRequest = ImageGenerateFactory::createRequestType($imageGenerateType, $modelVersion, $proxyModelRequest->getModel(), $data);
        $resolvedWatermark = di(WatermarkPolicyInterface::class)
            ->apply($modelGatewayDataIsolation->getAccessToken(), $proxyModelRequest->getWatermark());
        $imageGenerateRequest->setWatermarkConfig($resolvedWatermark);

        $implicitWatermark = new ImplicitWatermark();
        $implicitWatermark->setOrganizationCode($organizationCode)
            ->setUserId($creator)
            ->setTopicId($proxyModelRequest->getTopicId())
            ->setAccessTokenId((string) $modelGatewayDataIsolation->getAccessToken()->getId());

        $imageGenerateRequest->setImplicitWatermark($implicitWatermark);
        $imageGenerateRequest->setValidityPeriod(1);

        $imageModelConfig = $imageModel->getConfig();
        if (empty($imageModelConfig['model_version'])) {
            $imageModelConfig['model_version'] = $imageModel->getModelVersion();
        }
        // 是否开启代理 URL，解析代理 URL
        if (! empty($imageModelConfig['use_proxy'])) {
            $proxyUrl = $this->resolveProxyUrl($imageModelConfig);
            if ($proxyUrl) {
                $imageModelConfig['proxy_url'] = $proxyUrl;
            }
        }
        $imageGenerateService = ImageGenerateFactory::create($imageGenerateType, $imageModelConfig);
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

            // 统一触发事件
            $this->dispatchImageGeneratedEvent(
                $creator,
                $organizationCode,
                $proxyModelRequest,
                $n,
                $imageModel->getProviderModelId(),
                $callTime,
                $startTime,
                $modelGatewayDataIsolation->getAccessToken()
            );
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
     * Record text-to-image generation log.
     */
    protected function recordImageGenerateMessageLog(string $modelVersion, string $userId, string $organizationCode): void
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
            maxTokens: $sendMsgDTO->getMaxTokens() ?? 0,
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

    /**
     * 统一触发图片生成事件.
     *
     * @param string $creator 创建者ID
     * @param string $organizationCode 组织编码
     * @param AbstractRequestDTO $requestDTO 请求DTO
     * @param int $imageCount 图片数量
     * @param string $providerModelId 服务商模型ID
     * @param string $callTime 调用时间
     * @param float $startTime 开始时间（微秒）
     * @param null|AccessTokenEntity $accessTokenEntity 访问令牌实体
     */
    private function dispatchImageGeneratedEvent(
        string $creator,
        string $organizationCode,
        AbstractRequestDTO $requestDTO,
        int $imageCount,
        string $providerModelId,
        string $callTime,
        float $startTime,
        ?AccessTokenEntity $accessTokenEntity = null
    ): void {
        // 计算响应时间（毫秒）
        $responseTime = (int) ((microtime(true) - $startTime) * 1000);

        // 转换 providerModelId 为整数
        $serviceProviderModelsId = is_numeric($providerModelId) ? (int) $providerModelId : null;

        // 获取价格配置版本ID
        $priceId = $this->getPriceIdByServiceProviderModelId($serviceProviderModelsId, $organizationCode);

        // 构建并发布事件
        $event = $this->buildImageGenerateEntity(
            $creator,
            $organizationCode,
            $requestDTO,
            $imageCount,
            $providerModelId,
            $priceId,
            $callTime,
            $responseTime,
            $accessTokenEntity
        );
        AsyncEventUtil::dispatch($event);
    }

    /**
     * 获取服务商模型的价格配置版本ID.
     */
    private function getPriceIdByServiceProviderModelId(?int $serviceProviderModelsId, string $organizationCode): ?int
    {
        $providerDataIsolation = ProviderDataIsolation::create($organizationCode);
        $latestConfigVersion = $this->providerModelDomainService->getLatestConfigVersionEntity($providerDataIsolation, $serviceProviderModelsId);
        return $latestConfigVersion?->getId();
    }

    private function buildImageGenerateEntity(
        string $creator,
        string $organizationCode,
        AbstractRequestDTO $requestDTO,
        int $n,
        string $providerModelId,
        ?int $priceId = null,
        ?string $callTime = null,
        ?int $responseTime = null,
        ?AccessTokenEntity $accessTokenEntity = null
    ): ImageGeneratedEvent {
        $imageGeneratedEvent = new ImageGeneratedEvent();

        $model = $requestDTO->getModel();

        // 获取 access token 信息
        $accessTokenId = $accessTokenEntity?->getId();
        $accessTokenName = $accessTokenEntity?->getName();

        $imageGeneratedEvent->setOrganizationCode($organizationCode);
        $imageGeneratedEvent->setUserId($creator);
        $imageGeneratedEvent->setModel($model);
        $imageGeneratedEvent->setProviderModelId($providerModelId);
        $imageGeneratedEvent->setImageCount($n);
        $imageGeneratedEvent->setTopicId($requestDTO->getTopicId());
        $imageGeneratedEvent->setTaskId($requestDTO->getTaskId());
        $imageGeneratedEvent->setCreatedAt(new DateTime());
        $imageGeneratedEvent->setProviderModelId($providerModelId);
        $imageGeneratedEvent->setAccessTokenId($accessTokenId);
        $imageGeneratedEvent->setAccessTokenName($accessTokenName);
        $imageGeneratedEvent->setPriceId($priceId);
        $imageGeneratedEvent->setCallTime($callTime);
        $imageGeneratedEvent->setResponseTime($responseTime);
        // 设置原始 model_id（目前用于识别是否动态模型），用于计费服务
        $imageGeneratedEvent->setOriginalModelId($requestDTO->getOriginalModelId());

        if ($accessTokenEntity && $accessTokenEntity->getType()->isUser()) {
            $imageGeneratedEvent->setSourceType(ImageGenerateSourceEnum::API_PLATFORM);
        } elseif (! empty($requestDTO->getTopicId())) {
            $imageGeneratedEvent->setSourceType(ImageGenerateSourceEnum::SUPER_MAGIC);
        } else {
            $imageGeneratedEvent->setSourceType(ImageGenerateSourceEnum::API);
        }

        return $imageGeneratedEvent;
    }

    /**
     * 解析代理 URL.
     */
    private function resolveProxyUrl(array $config): ?string
    {
        // 调用 Resolver 解析
        return di(ProxyConfigResolverInterface::class)->resolve($config);
    }

    /**
     * @param array<int, array<string, mixed>> $providers
     * @return array<string, mixed>
     */
    private function resolveAiAbilityProviderConfig(array $providers, string $requestedProvider, string $defaultErrorMessage): array
    {
        $requestedProvider = strtolower(trim($requestedProvider));

        if ($requestedProvider !== '') {
            $matchedProviderConfig = null;
            foreach ($providers as $providerConfig) {
                $providerName = strtolower(trim((string) ($providerConfig['provider'] ?? '')));
                if ($providerName === $requestedProvider) {
                    $matchedProviderConfig = $providerConfig;
                    break;
                }
            }

            if ($matchedProviderConfig === null) {
                ExceptionBuilder::throw(
                    MagicApiErrorCode::MODEL_RESPONSE_FAIL,
                    sprintf("Specified provider '%s' is not configured", $requestedProvider)
                );
            }

            return $matchedProviderConfig;
        }

        foreach ($providers as $providerConfig) {
            if (($providerConfig['enable'] ?? false) === true) {
                return $providerConfig;
            }
        }

        ExceptionBuilder::throw(
            MagicApiErrorCode::MODEL_RESPONSE_FAIL,
            $defaultErrorMessage
        );
    }
}
