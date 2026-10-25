<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\Kernel\EnvManager;
use App\Application\ModelGateway\Component\Points\PointComponentInterface;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Application\ModelGateway\Request\ModelGatewayRequestCoContext;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ImageGenerate\Contract\WatermarkConfigInterface;
use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
use App\Domain\ModelGateway\Entity\Dto\AbstractRequestDTO;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\ModelGateway\Event\ImageOperationCompletedEvent;
use App\Domain\ModelGateway\Service\AccessTokenDomainService;
use App\Domain\ModelGateway\Service\ApplicationDomainService;
use App\Domain\ModelGateway\Service\ModelConfigDomainService;
use App\Domain\ModelGateway\Service\MsgLogDomainService;
use App\Domain\ModelGateway\Service\OrganizationConfigDomainService;
use App\Domain\ModelGateway\Service\UserConfigDomainService;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Domain\SuperMagic\Agent\Service\MagicClawRuntimePolicyDomainService;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\FileUrlProxy\TemporaryFileUrlProxyManager;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use DateTime;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

abstract class AbstractLLMAppService extends AbstractKernelAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected readonly ApplicationDomainService $applicationDomainService,
        protected readonly ModelConfigDomainService $modelConfigDomainService,
        protected readonly AccessTokenDomainService $accessTokenDomainService,
        protected readonly OrganizationConfigDomainService $organizationConfigDomainService,
        protected readonly UserConfigDomainService $userConfigDomainService,
        protected readonly MsgLogDomainService $msgLogDomainService,
        protected readonly MagicUserDomainService $magicUserDomainService,
        protected LoggerFactory $loggerFactory,
        protected AdminProviderDomainService $serviceProviderDomainService,
        protected ModelGatewayMapper $modelGatewayMapper,
        protected FileDomainService $fileDomainService,
        protected WatermarkConfigInterface $watermarkConfig,
        protected PointComponentInterface $pointComponent,
        protected ImageWatermarkProcessor $imageWatermarkProcessor,
        protected PackageFilterInterface $packageFilter,
        protected ProviderModelDomainService $providerModelDomainService,
        protected AggregateModelResolverService $aggregateModelResolverService,
        protected ModelGatewayModelAccessService $modelGatewayModelAccessService,
        protected TemporaryFileUrlProxyManager $temporaryFileUrlProxyManager,
    ) {
        $this->logger = $this->loggerFactory->get(static::class);
    }

    public function createModelGatewayDataIsolationByAccessToken(string $inputAccessToken, array $businessParams = [], bool $enforceRuntimePermission = true): ModelGatewayDataIsolation
    {
        if (empty($inputAccessToken)) {
            ExceptionBuilder::throw(MagicApiErrorCode::TOKEN_NOT_EXIST);
        }
        if (! $accessToken = ModelGatewayRequestCoContext::getAccessToken()) {
            $accessToken = $this->accessTokenDomainService->getByAccessToken($inputAccessToken);
        }

        if (! $accessToken) {
            ExceptionBuilder::throw(MagicApiErrorCode::TOKEN_NOT_EXIST);
        }
        if (! $accessToken->isEnabled()) {
            ExceptionBuilder::throw(MagicApiErrorCode::TOKEN_DISABLED);
        }

        // 兼容
        if (isset($businessParams['organization_id'])) {
            $businessParams['organization_code'] = $businessParams['organization_id'];
        }
        if (isset($businessParams['organization_code'])) {
            $businessParams['organization_id'] = $businessParams['organization_code'];
        }

        /** @var ModelGatewayDataIsolation $dataIsolation */
        $dataIsolation = match ($accessToken->getType()) {
            AccessTokenType::Application => ModelGatewayDataIsolation::create(
                $this->getApplicationOrganizationCode($businessParams),
                $this->getApplicationUserId($businessParams)
            ),
            AccessTokenType::User => ModelGatewayDataIsolation::create($accessToken->getOrganizationCode(), $accessToken->getRelationId()),
            default => ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'Access token type not supported'),
        };
        EnvManager::initDataIsolationEnv($dataIsolation);
        $dataIsolation->setAccessToken($accessToken);

        $dataIsolation->setSourceId($this->getBusinessParam('source_id', '', $businessParams));
        if ($accessToken->getType()->isApplication()) {
            $dataIsolation->setAppId($accessToken->getRelationId());
            $taskId = $this->getBusinessParam('magic_task_id', '', $businessParams);
            if (! empty($taskId)) {
                $dataIsolation->setSourceId(SourceId::SUPER_MAGIC);
                $dataIsolation->setBusinessId($taskId);
            }
        }

        if ($accessToken->getType()->isUser()) {
            $dataIsolation->setSourceId(SourceId::API_PLATFORM);
        }

        // 设置业务参数
        $dataIsolation->setUserName($this->getBusinessParam('user_name', '', $businessParams));

        if ($dataIsolation->getAccessToken()->getType()->isUser()) {
            $dataIsolation->getSubscriptionManager()->setEnabled(false);
        }

        if ($enforceRuntimePermission) {
            di(MagicClawRuntimePolicyDomainService::class)->assertModelInvocation($dataIsolation, $businessParams);
        }
        return $dataIsolation;
    }

    protected function dispatchImageOperationCompletedEvent(
        ModelGatewayDataIsolation $dataIsolation,
        AbstractRequestDTO $requestDTO,
        string $operationType,
        string $provider,
        string $callTime,
        int $responseTime,
        int $operationTime,
        array $generatedImages,
        int $imageCount = 1,
        array $extraBusinessParams = [],
    ): void {
        $accessTokenEntity = $dataIsolation->getAccessToken();
        $businessParams = array_merge(
            $requestDTO->getBusinessParams(),
            [
                'operation_type' => $operationType,
                'provider' => $provider,
                'image_count' => $imageCount,
                'response_duration' => $responseTime,
                'operation_time' => $operationTime,
                'original_model_id' => $requestDTO->getOriginalModelId(),
                'organization_id' => $dataIsolation->getCurrentOrganizationCode(),
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'user_id' => $dataIsolation->getCurrentUserId(),
                'source_id' => $dataIsolation->getSourceId(),
                'request_id' => CoContext::getRequestId(),
                'access_token_id' => $accessTokenEntity->getId(),
                'access_token_name' => $accessTokenEntity->getName(),
                'access_token_type' => $accessTokenEntity->getType()->value,
                'event_id' => (string) IdGenerator::getSnowId(),
            ],
            $extraBusinessParams
        );

        $event = new ImageOperationCompletedEvent();
        $event->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $event->setUserId($dataIsolation->getCurrentUserId());
        $event->setOperationType($operationType);
        $event->setProvider($provider);
        $event->setImageCount($imageCount);
        $event->setOriginalModelId($requestDTO->getOriginalModelId());
        $event->setCallTime($callTime);
        $event->setResponseTime($responseTime);
        $event->setTopicId($requestDTO->getTopicId());
        $event->setTaskId($requestDTO->getTaskId());
        $event->setAccessTokenId($accessTokenEntity->getId());
        $event->setAccessTokenName($accessTokenEntity->getName());
        $event->setSourceId($dataIsolation->getSourceId());
        $event->setSourceType($this->resolveImageOperationSourceType($dataIsolation, $requestDTO));
        $event->setCreatedAt(new DateTime());
        $event->setGeneratedImages($generatedImages);
        $event->setBusinessParams($businessParams);

        AsyncEventUtil::dispatch($event);
    }

    private function getApplicationOrganizationCode(array $businessParams = []): string
    {
        $org = $this->getBusinessParam('organization_code', '', $businessParams);
        if (empty($org)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'Organization code is required for application access token');
        }
        return $org;
    }

    private function getApplicationUserId(array $businessParams = []): string
    {
        $userId = $this->getBusinessParam('user_id', '', $businessParams);
        if (empty($userId)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'User id is required for application access token');
        }
        return $userId;
    }

    private function getBusinessParam(string $key, mixed $default = null, array $businessParams = []): mixed
    {
        $key = strtolower($key);
        if (isset($businessParams[$key])) {
            return $businessParams[$key];
        }

        if (! container()->has(RequestInterface::class)) {
            return $default;
        }

        try {
            $request = container()->get(RequestInterface::class);
            if (! method_exists($request, 'getHeaders') || ! method_exists($request, 'getHeader') || ! method_exists($request, 'input')) {
                return $default;
            }
            $headerConfigs = [];
            foreach ($request->getHeaders() as $k => $value) {
                $k = strtolower((string) $k);
                $headerConfigs[$k] = $request->getHeader($k)[0] ?? '';
            }
            if (isset($headerConfigs['business_id']) && $key === 'business_id') {
                return $headerConfigs['business_id'];
            }
            if (isset($headerConfigs['magic-organization-id']) && ($key === 'organization_id' || $key === 'organization_code')) {
                return $headerConfigs['magic-organization-id'];
            }
            if (isset($headerConfigs['magic-organization-code']) && ($key === 'organization_id' || $key === 'organization_code')) {
                return $headerConfigs['magic-organization-code'];
            }
            if (isset($headerConfigs['magic-user-id']) && $key === 'user_id') {
                return $headerConfigs['magic-user-id'];
            }
            return $request->input('business_params.' . $key, $default);
        } catch (Throwable) {
            return $default;
        }
    }

    private function resolveImageOperationSourceType(
        ModelGatewayDataIsolation $dataIsolation,
        AbstractRequestDTO $requestDTO,
    ): ImageGenerateSourceEnum {
        if ($dataIsolation->getAccessToken()->getType()->isUser()) {
            return ImageGenerateSourceEnum::API_PLATFORM;
        }

        if (! empty($requestDTO->getTopicId())) {
            return ImageGenerateSourceEnum::SUPER_MAGIC;
        }

        return ImageGenerateSourceEnum::API;
    }
}
