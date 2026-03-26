<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\Audit\ModelCall\Service\AuditService;
use App\Application\Kernel\AbstractKernelAppService;
use App\Application\Kernel\EnvManager;
use App\Application\ModelGateway\Component\Points\PointComponentInterface;
use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditStatus;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditType;
use App\Domain\Audit\ModelCall\Entity\ValueObject\ModelAuditAccessScope;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ImageGenerate\Contract\WatermarkConfigInterface;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Service\AccessTokenDomainService;
use App\Domain\ModelGateway\Service\ApplicationDomainService;
use App\Domain\ModelGateway\Service\ModelConfigDomainService;
use App\Domain\ModelGateway\Service\MsgLogDomainService;
use App\Domain\ModelGateway\Service\OrganizationConfigDomainService;
use App\Domain\ModelGateway\Service\UserConfigDomainService;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ImageGenerate\ImageWatermarkProcessor;
use Hyperf\Context\Context;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

abstract class AbstractLLMAppService extends AbstractKernelAppService
{
    private const string AUDIT_DISPATCHED_KEYS = 'model_gateway.audit.dispatched_keys';

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
        protected readonly AuditService $auditService
    ) {
        $this->logger = $this->loggerFactory->get(static::class);
    }

    public function createModelGatewayDataIsolationByAccessToken(string $inputAccessToken, array $businessParams = []): ModelGatewayDataIsolation
    {
        if (empty($inputAccessToken)) {
            ExceptionBuilder::throw(MagicApiErrorCode::TOKEN_NOT_EXIST);
        }
        $accessToken = $this->accessTokenDomainService->getByAccessToken($inputAccessToken);
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
                $dataIsolation->setSourceId('super_magic');
                $dataIsolation->setBusinessId($taskId);
            }
        }

        if ($accessToken->getType()->isUser()) {
            $dataIsolation->setSourceId('api_platform');
        }

        // 设置业务参数
        $dataIsolation->setUserName($this->getBusinessParam('user_name', '', $businessParams));

        if ($dataIsolation->getAccessToken()->getType()->isUser()) {
            $dataIsolation->getSubscriptionManager()->setEnabled(false);
        }

        return $dataIsolation;
    }

    protected function dispatchAuditEventOnce(
        array $userInfo,
        string $ip,
        AuditType $type,
        string $productCode,
        string $accessToken,
        float $startTime,
        int $latencyMs,
        AuditStatus $status,
        array $usage = [],
        ?array $detailInfo = null,
        array $businessParams = [],
        string $sourceMarker = ''
    ): void {
        $dispatchBusinessParams = $businessParams;
        if ($sourceMarker !== '') {
            $dispatchBusinessParams['audit_source_marker'] = $sourceMarker;
        }

        $accessScope = $this->resolveAccessScopeForAudit($dispatchBusinessParams, $accessToken);

        $dispatchKey = $this->buildAuditDispatchKey($type, $dispatchBusinessParams);
        if ($dispatchKey === '') {
            $this->auditService->dispatchAuditEvent(
                userInfo: $userInfo,
                ip: $ip,
                type: $type,
                productCode: $productCode,
                accessToken: $accessToken,
                startTime: $startTime,
                latencyMs: $latencyMs,
                status: $status,
                usage: $usage,
                detailInfo: $detailInfo,
                businessParams: $dispatchBusinessParams,
                accessScope: $accessScope,
            );
            return;
        }

        $dispatchedKeys = Context::get(self::AUDIT_DISPATCHED_KEYS, []);
        if (! is_array($dispatchedKeys)) {
            $dispatchedKeys = [];
        }

        if (in_array($dispatchKey, $dispatchedKeys, true)) {
            return;
        }

        $dispatchedKeys[] = $dispatchKey;
        Context::set(self::AUDIT_DISPATCHED_KEYS, $dispatchedKeys);

        $this->auditService->dispatchAuditEvent(
            userInfo: $userInfo,
            ip: $ip,
            type: $type,
            productCode: $productCode,
            accessToken: $accessToken,
            startTime: $startTime,
            latencyMs: $latencyMs,
            status: $status,
            usage: $usage,
            detailInfo: $detailInfo,
            businessParams: $dispatchBusinessParams,
            accessScope: $accessScope,
        );
    }

    /**
     * 与 {@see createModelGatewayDataIsolationByAccessToken} 一致：User→开放平台，Application→Magic；无 token 字符串的会话类审计视为 Magic.
     */
    protected function resolveAccessScopeForAudit(array $businessParams, string $accessToken): ModelAuditAccessScope
    {
        $tokenType = (string) ($businessParams['access_token_type'] ?? '');
        if ($tokenType === AccessTokenType::User->value) {
            return ModelAuditAccessScope::ApiPlatform;
        }
        if ($tokenType === AccessTokenType::Application->value) {
            return ModelAuditAccessScope::Magic;
        }
        if ($accessToken === '') {
            return ModelAuditAccessScope::Magic;
        }
        $tokenEntity = $this->accessTokenDomainService->getByAccessToken($accessToken);
        if ($tokenEntity === null) {
            return ModelAuditAccessScope::Magic;
        }

        return ModelAuditAccessScope::fromAccessTokenType($tokenEntity->getType());
    }

    protected function buildAuditDispatchKey(AuditType $type, array $businessParams = []): string
    {
        $requestId = (string) ($businessParams['request_id'] ?? '');
        if ($requestId === '') {
            return '';
        }

        return implode('|', [
            $requestId,
            $type->value,
            (string) ($businessParams['audit_source_marker'] ?? ''),
        ]);
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
}
