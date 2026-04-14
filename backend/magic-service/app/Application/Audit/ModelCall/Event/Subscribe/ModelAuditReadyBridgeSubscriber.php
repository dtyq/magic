<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Audit\ModelCall\Event\Subscribe;

use App\Application\Audit\ModelCall\Event\ModelAuditReadyEvent;
use App\Application\ModelGateway\Event\ImageSearchUsageEvent;
use App\Application\ModelGateway\Event\ModelUsageEvent;
use App\Application\ModelGateway\Event\WebSearchUsageEvent;
use App\Application\ModelGateway\Support\InvocationDetailInfo;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditStatus;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditType;
use App\Domain\Audit\ModelCall\Entity\ValueObject\ModelAuditAccessScope;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Event\ImageGeneratedEvent;
use App\Domain\ModelGateway\Event\ImageGenerateFailedEvent;
use App\Domain\ModelGateway\Event\VideoGeneratedEvent;
use App\Domain\ModelGateway\Event\VideoGenerateFailedEvent;
use App\Domain\ModelGateway\Service\AccessTokenDomainService;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\StringMaskUtil;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Odin\Api\Response\Usage;
use Hyperf\Odin\Event\AfterChatCompletionsEvent;
use Hyperf\Odin\Event\AfterChatCompletionsStreamEvent;
use Hyperf\Odin\Event\AfterEmbeddingsEvent;
use Psr\Log\LoggerInterface;

/**
 * 统一审计管道 Bridge：监听所有业务事件和 Odin 后置事件，
 * 组装完整审计快照后 dispatch ModelAuditReadyEvent，
 * 由 ModelAuditPersistSubscriber 在同一次 dispatch 内同步一次性 INSERT。
 */
#[Listener]
class ModelAuditReadyBridgeSubscriber implements ListenerInterface
{
    public function __construct(
        private readonly AccessTokenDomainService $accessTokenDomainService,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function listen(): array
    {
        return [
            ModelUsageEvent::class,
            WebSearchUsageEvent::class,
            ImageSearchUsageEvent::class,
            ImageGenerateFailedEvent::class,
            ImageGeneratedEvent::class,
            VideoGenerateFailedEvent::class,
            VideoGeneratedEvent::class,
            // Odin 后置事件：TEXT/EMBEDDING 成功时 usage 已 ready，一次性落完整行
            AfterChatCompletionsEvent::class,
            AfterChatCompletionsStreamEvent::class,
            AfterEmbeddingsEvent::class,
        ];
    }

    public function process(object $event): void
    {
        // AfterChatCompletionsStreamEvent 继承自 AfterChatCompletionsEvent，必须先匹配子类
        match (true) {
            $event instanceof ModelUsageEvent => $this->processModelUsage($event),
            $event instanceof WebSearchUsageEvent => $this->processWebSearchUsage($event),
            $event instanceof ImageSearchUsageEvent => $this->processImageSearchUsage($event),
            $event instanceof ImageGenerateFailedEvent => $this->processImageGenerateFailed($event),
            $event instanceof ImageGeneratedEvent => $this->processImageGenerated($event),
            $event instanceof VideoGenerateFailedEvent => $this->processVideoGenerateFailed($event),
            $event instanceof VideoGeneratedEvent => $this->processVideoGenerated($event),
            $event instanceof AfterChatCompletionsStreamEvent => $this->processAfterChatCompletionsStream($event),
            $event instanceof AfterChatCompletionsEvent => $this->processAfterChatCompletions($event),
            $event instanceof AfterEmbeddingsEvent => $this->processAfterEmbeddings($event),
            default => null,
        };
    }

    private function processModelUsage(ModelUsageEvent $event): void
    {
        $businessParams = $event->getBusinessParams();
        if (($businessParams['is_success'] ?? true) !== false) {
            return;
        }

        $accessTokenRaw = (string) ($businessParams['access_token_raw'] ?? '');
        $auditType = match ((string) ($businessParams['model_type'] ?? '')) {
            'embedding' => AuditType::EMBEDDING,
            'image' => AuditType::IMAGE,
            default => AuditType::TEXT,
        };
        $accessScope = $this->resolveAccessScopeForAudit($businessParams, $accessTokenRaw);
        $accessTokenName = $this->resolveAccessTokenName($accessTokenRaw);
        $businessParams = array_merge($businessParams, [
            'access_token_name' => $accessTokenName,
            'model_version' => (string) ($businessParams['model_version'] ?? $event->modelVersion),
            'provider_name' => (string) ($businessParams['provider_name'] ?? ''),
            'audit_source_marker' => 'processRequest',
            'request_id' => trim((string) ($businessParams['request_id'] ?? '')),
        ]);

        $detailInfo = InvocationDetailInfo::forModel(
            (string) ($businessParams['app_id'] ?? $event->getAppId()),
            (string) ($businessParams['source_id'] ?? ''),
            (string) ($businessParams['service_provider_model_id'] ?? $event->getServiceProviderModelId()),
            InvocationDetailInfo::withFailureReason(
                [
                    'original_model_id' => (string) ($businessParams['original_model_id'] ?? $event->getModelId()),
                ],
                (string) ($businessParams['failure_reason'] ?? ''),
            ),
        );

        AsyncEventUtil::dispatch(new ModelAuditReadyEvent(
            type: $auditType->value,
            productCode: (string) ($businessParams['model_id'] ?? $event->getModelId()),
            status: AuditStatus::FAIL->value,
            ak: (string) ($businessParams['ak'] ?? StringMaskUtil::mask($accessTokenRaw)),
            operationTime: (int) ($businessParams['operation_time'] ?? 0),
            allLatency: (int) ($businessParams['response_duration'] ?? 0),
            userInfo: [
                'organization_code' => (string) ($businessParams['organization_id'] ?? $event->getOrganizationCode()),
                'user_id' => (string) ($businessParams['user_id'] ?? $event->getUserId()),
                'user_name' => (string) ($businessParams['user_name'] ?? ''),
            ],
            usage: [],
            detailInfo: $detailInfo,
            businessParams: $businessParams,
            accessScope: $accessScope,
            eventId: $this->resolveModelAuditEventId($businessParams),
        ));
    }

    private function processWebSearchUsage(WebSearchUsageEvent $event): void
    {
        $this->dispatchSearchAudit($event->businessParams);
    }

    private function processImageSearchUsage(ImageSearchUsageEvent $event): void
    {
        $this->dispatchSearchAudit($event->businessParams);
    }

    private function processImageGenerated(ImageGeneratedEvent $event): void
    {
        $bp = $event->getBusinessParams();
        $accessTokenRaw = (string) ($bp['access_token_raw'] ?? '');
        $accessScope = $this->resolveAccessScopeForAudit($bp, $accessTokenRaw);
        $accessTokenName = $this->resolveAccessTokenName($accessTokenRaw);
        $chain = (string) ($bp['chain'] ?? '');
        $businessParams = array_merge($bp, [
            'access_token_name' => $accessTokenName,
            'audit_source_marker' => $chain,
            'request_id' => trim((string) ($bp['request_id'] ?? '')),
        ]);

        $outcome = (string) ($bp['outcome'] ?? 'success');
        $extras = [
            'chain' => $chain,
            'original_model_id' => (string) ($bp['original_model_id'] ?? ''),
        ];
        if ($this->mapOutcomeToAuditStatus($outcome) === AuditStatus::FAIL) {
            $extras = InvocationDetailInfo::withFailureReason($extras, (string) ($bp['failure_reason'] ?? ''));
        }
        $detailInfo = InvocationDetailInfo::forModel(
            (string) ($bp['app_id'] ?? ''),
            (string) ($bp['source_id'] ?? ''),
            (string) ($bp['provider_model_id'] ?? ''),
            $extras,
        );

        $usage = strtolower($outcome) === 'success' ? ['count' => (int) ($bp['image_count'] ?? 0)] : [];

        AsyncEventUtil::dispatch(new ModelAuditReadyEvent(
            type: AuditType::IMAGE->value,
            productCode: (string) ($bp['model_id'] ?? ''),
            status: $this->mapOutcomeToAuditStatus($outcome)->value,
            ak: (string) ($bp['ak'] ?? StringMaskUtil::mask($accessTokenRaw)),
            operationTime: (int) ($bp['operation_time'] ?? 0),
            allLatency: (int) ($bp['response_duration'] ?? 0),
            userInfo: [
                'organization_code' => (string) ($bp['organization_id'] ?? ''),
                'user_id' => (string) ($bp['user_id'] ?? ''),
                'user_name' => (string) ($bp['user_name'] ?? ''),
            ],
            usage: $usage,
            detailInfo: $detailInfo,
            businessParams: $businessParams,
            accessScope: $accessScope,
            eventId: $this->resolveModelAuditEventId($businessParams),
        ));
    }

    private function processImageGenerateFailed(ImageGenerateFailedEvent $event): void
    {
        $bp = $event->getBusinessParams();
        $accessTokenRaw = (string) ($bp['access_token_raw'] ?? '');
        $accessScope = $this->resolveAccessScopeForAudit($bp, $accessTokenRaw);
        $accessTokenName = $this->resolveAccessTokenName($accessTokenRaw);
        $chain = (string) ($bp['chain'] ?? '');
        $businessParams = array_merge($bp, [
            'access_token_name' => $accessTokenName,
            'model_version' => (string) ($bp['model_version'] ?? ''),
            'provider_name' => (string) ($bp['provider_name'] ?? ''),
            'audit_source_marker' => $chain,
            'request_id' => trim((string) ($bp['request_id'] ?? '')),
        ]);

        $detailInfo = InvocationDetailInfo::forModel(
            (string) ($bp['app_id'] ?? ''),
            (string) ($bp['source_id'] ?? ''),
            $event->getProviderModelId(),
            InvocationDetailInfo::withFailureReason(
                [
                    'chain' => $chain,
                    'original_model_id' => (string) ($bp['original_model_id'] ?? ''),
                ],
                (string) ($bp['failure_reason'] ?? ''),
            ),
        );

        AsyncEventUtil::dispatch(new ModelAuditReadyEvent(
            type: AuditType::IMAGE->value,
            productCode: $event->getModel(),
            status: AuditStatus::FAIL->value,
            ak: (string) ($bp['ak'] ?? StringMaskUtil::mask($accessTokenRaw)),
            operationTime: (int) ($bp['operation_time'] ?? 0),
            allLatency: (int) ($bp['response_duration'] ?? 0),
            userInfo: [
                'organization_code' => $event->getOrganizationCode(),
                'user_id' => $event->getUserId(),
                'user_name' => (string) ($bp['user_name'] ?? ''),
            ],
            usage: [],
            detailInfo: $detailInfo,
            businessParams: $businessParams,
            accessScope: $accessScope,
            eventId: $this->resolveModelAuditEventId($businessParams),
        ));
    }

    private function processVideoGenerated(VideoGeneratedEvent $event): void
    {
        $bp = $event->getBusinessParams();
        $accessTokenRaw = (string) ($bp['access_token_raw'] ?? '');
        $accessScope = $this->resolveAccessScopeForAudit($bp, $accessTokenRaw);
        $originalModelId = (string) ($bp['original_model_id'] ?? ($event->getOriginalModelId() ?? $event->getModel()));
        $businessParams = $bp;
        $businessParams['access_token_name'] = (string) ($bp['access_token_name'] ?? '');
        $businessParams['audit_source_marker'] = 'videoGenerate';
        $businessParams['request_id'] = trim((string) ($bp['request_id'] ?? ''));

        $detailInfo = InvocationDetailInfo::forModel(
            (string) ($bp['app_id'] ?? ''),
            (string) ($bp['source_id'] ?? ''),
            (string) ($bp['provider_model_id'] ?? $event->getProviderModelId()),
            ['original_model_id' => $originalModelId],
        );

        AsyncEventUtil::dispatch(new ModelAuditReadyEvent(
            type: AuditType::VIDEO->value,
            productCode: (string) ($bp['model_id'] ?? $event->getModel()),
            status: AuditStatus::SUCCESS->value,
            ak: (string) ($bp['ak'] ?? StringMaskUtil::mask($accessTokenRaw)),
            operationTime: (int) ($bp['operation_time'] ?? 0),
            allLatency: (int) ($bp['response_duration'] ?? 0),
            userInfo: [
                'organization_code' => (string) ($bp['organization_id'] ?? $event->getOrganizationCode()),
                'user_id' => (string) ($bp['user_id'] ?? $event->getUserId()),
                'user_name' => (string) ($bp['user_name'] ?? ''),
            ],
            usage: ['count' => 1, 'duration_seconds' => $event->getDurationSeconds()],
            detailInfo: $detailInfo,
            businessParams: $businessParams,
            accessScope: $accessScope,
            eventId: $this->resolveModelAuditEventId($businessParams),
        ));
    }

    private function processVideoGenerateFailed(VideoGenerateFailedEvent $event): void
    {
        $bp = $event->getBusinessParams();
        $accessTokenRaw = (string) ($bp['access_token_raw'] ?? '');
        $accessScope = $this->resolveAccessScopeForAudit($bp, $accessTokenRaw);
        $originalModelId = (string) ($bp['original_model_id'] ?? $event->getModel());
        $businessParams = $bp;
        $businessParams['access_token_name'] = (string) ($bp['access_token_name'] ?? '');
        $businessParams['model_version'] = (string) ($bp['model_version'] ?? '');
        $businessParams['provider_name'] = (string) ($bp['provider_name'] ?? '');
        $businessParams['audit_source_marker'] = 'videoGenerate';
        $businessParams['request_id'] = trim((string) ($bp['request_id'] ?? ''));

        $detailInfo = InvocationDetailInfo::forModel(
            (string) ($bp['app_id'] ?? ''),
            (string) ($bp['source_id'] ?? ''),
            $event->getProviderModelId(),
            InvocationDetailInfo::withFailureReason(
                ['original_model_id' => $originalModelId],
                (string) ($bp['failure_reason'] ?? ''),
            ),
        );

        AsyncEventUtil::dispatch(new ModelAuditReadyEvent(
            type: AuditType::VIDEO->value,
            productCode: (string) ($bp['model_id'] ?? $event->getModel()),
            status: AuditStatus::FAIL->value,
            ak: (string) ($bp['ak'] ?? StringMaskUtil::mask($accessTokenRaw)),
            operationTime: (int) ($bp['operation_time'] ?? 0),
            allLatency: (int) ($bp['response_duration'] ?? 0),
            userInfo: [
                'organization_code' => (string) ($bp['organization_id'] ?? $event->getOrganizationCode()),
                'user_id' => (string) ($bp['user_id'] ?? $event->getUserId()),
                'user_name' => (string) ($bp['user_name'] ?? ''),
            ],
            usage: [],
            detailInfo: $detailInfo,
            businessParams: $businessParams,
            accessScope: $accessScope,
            eventId: $this->resolveModelAuditEventId($businessParams),
        ));
    }

    private function dispatchSearchAudit(array $businessParams): void
    {
        $accessTokenRaw = (string) ($businessParams['access_token_raw'] ?? '');
        $accessScope = $this->resolveAccessScopeForAudit($businessParams, $accessTokenRaw);
        $accessTokenName = $this->resolveAccessTokenName($accessTokenRaw);
        $chain = (string) ($businessParams['chain'] ?? '');
        $engineName = (string) ($businessParams['engine'] ?? '');
        $businessParams = array_merge($businessParams, [
            'access_token_name' => $accessTokenName,
            'model_version' => '',
            'provider_name' => '',
            'audit_source_marker' => $chain,
            'request_id' => trim((string) ($businessParams['request_id'] ?? '')),
        ]);

        $outcome = (string) ($businessParams['outcome'] ?? '');
        $extras = [];
        if ($this->mapOutcomeToAuditStatus($outcome) === AuditStatus::FAIL) {
            $extras = InvocationDetailInfo::withFailureReason([], (string) ($businessParams['failure_reason'] ?? ''));
        }
        $detailInfo = InvocationDetailInfo::forTool(
            (string) ($businessParams['app_id'] ?? ''),
            (string) ($businessParams['source_id'] ?? ''),
            $engineName,
            (string) ($businessParams['query'] ?? ''),
            $extras,
        );

        $usage = strtolower($outcome) === 'success' ? ['count' => 1] : [];

        AsyncEventUtil::dispatch(new ModelAuditReadyEvent(
            type: AuditType::SEARCH->value,
            productCode: $engineName,
            status: $this->mapOutcomeToAuditStatus($outcome)->value,
            ak: (string) ($businessParams['ak'] ?? StringMaskUtil::mask($accessTokenRaw)),
            operationTime: (int) ($businessParams['operation_time'] ?? 0),
            allLatency: (int) ($businessParams['response_duration'] ?? 0),
            userInfo: [
                'organization_code' => (string) ($businessParams['organization_id'] ?? ''),
                'user_id' => (string) ($businessParams['user_id'] ?? ''),
                'user_name' => (string) ($businessParams['user_name'] ?? ''),
            ],
            usage: $usage,
            detailInfo: $detailInfo,
            businessParams: $businessParams,
            accessScope: $accessScope,
            eventId: $this->resolveModelAuditEventId($businessParams),
        ));
    }

    private function processAfterChatCompletions(AfterChatCompletionsEvent $event): void
    {
        $req = $event->getCompletionRequest();
        $res = $event->getCompletionResponse();
        $bp = $req->getBusinessParams();

        $usage = $res->getUsage();
        if (! $usage) {
            $req->calculateTokenEstimates();
            $res->calculateTokenEstimates();
            $usage = new Usage(promptTokens: 0, completionTokens: 0, totalTokens: 0);
        }

        $operationTime = (int) ($bp['operation_time'] ?? 0);
        $ak = (string) ($bp['ak'] ?? '');
        // access_token_raw 由 LLMAppService::processRequest 提前写入 businessParams，仅用于查库，不落库
        $accessTokenRaw = (string) ($bp['access_token_raw'] ?? '');

        $accessScope = $this->resolveAccessScopeForAudit($bp, $accessTokenRaw);
        $accessTokenName = $this->resolveAccessTokenName($accessTokenRaw);

        $businessParams = array_merge($bp, [
            'access_token_name' => $accessTokenName,
            'audit_source_marker' => 'processRequest',
            'request_id' => trim((string) ($bp['request_id'] ?? '')),
        ]);

        $detailInfo = InvocationDetailInfo::forModel(
            (string) ($bp['app_id'] ?? ''),
            (string) ($bp['source_id'] ?? ''),
            (string) ($bp['service_provider_model_id'] ?? ''),
            ['original_model_id' => (string) ($bp['original_model_id'] ?? '')],
        );

        AsyncEventUtil::dispatch(new ModelAuditReadyEvent(
            type: AuditType::TEXT->value,
            productCode: (string) ($bp['model_id'] ?? $req->getModel()),
            status: AuditStatus::SUCCESS->value,
            ak: $ak,
            operationTime: $operationTime,
            allLatency: (int) $event->getDuration(),
            userInfo: [
                'organization_code' => (string) ($bp['organization_id'] ?? ''),
                'user_id' => (string) ($bp['user_id'] ?? ''),
                'user_name' => (string) ($bp['user_name'] ?? ''),
            ],
            usage: $usage->toArray(),
            detailInfo: $detailInfo,
            businessParams: $businessParams,
            accessScope: $accessScope,
            eventId: $this->resolveModelAuditEventId($businessParams),
        ));
    }

    private function processAfterChatCompletionsStream(AfterChatCompletionsStreamEvent $event): void
    {
        $req = $event->getCompletionRequest();
        $res = $event->getCompletionResponse();
        $bp = $req->getBusinessParams();

        $usage = $res->getUsage();
        // 流式结束仍无 usage：不落审计（禁止回填）
        if (! $usage) {
            return;
        }

        $operationTime = (int) ($bp['operation_time'] ?? 0);
        $ak = (string) ($bp['ak'] ?? '');
        $accessTokenRaw = (string) ($bp['access_token_raw'] ?? '');

        $accessScope = $this->resolveAccessScopeForAudit($bp, $accessTokenRaw);
        $accessTokenName = $this->resolveAccessTokenName($accessTokenRaw);

        $businessParams = array_merge($bp, [
            'access_token_name' => $accessTokenName,
            'audit_source_marker' => 'processRequest',
            'request_id' => trim((string) ($bp['request_id'] ?? '')),
        ]);

        $detailInfo = InvocationDetailInfo::forModel(
            (string) ($bp['app_id'] ?? ''),
            (string) ($bp['source_id'] ?? ''),
            (string) ($bp['service_provider_model_id'] ?? ''),
            ['original_model_id' => (string) ($bp['original_model_id'] ?? '')],
        );

        $firstResponseLatency = (int) $event->getFirstResponseDuration();
        AsyncEventUtil::dispatch(new ModelAuditReadyEvent(
            type: AuditType::TEXT->value,
            productCode: (string) ($bp['model_id'] ?? $req->getModel()),
            status: AuditStatus::SUCCESS->value,
            ak: $ak,
            operationTime: $operationTime,
            // 流式总延时 = TTFT（等待第一个chunk）+ 流消费耗时（getDuration 从消费开始计）
            allLatency: $firstResponseLatency + (int) $event->getDuration(),
            userInfo: [
                'organization_code' => (string) ($bp['organization_id'] ?? ''),
                'user_id' => (string) ($bp['user_id'] ?? ''),
                'user_name' => (string) ($bp['user_name'] ?? ''),
            ],
            usage: $usage->toArray(),
            detailInfo: $detailInfo,
            businessParams: $businessParams,
            accessScope: $accessScope,
            firstResponseLatency: $firstResponseLatency,
            eventId: $this->resolveModelAuditEventId($businessParams),
        ));
    }

    private function processAfterEmbeddings(AfterEmbeddingsEvent $event): void
    {
        $req = $event->getEmbeddingRequest();
        $res = $event->getEmbeddingResponse();
        $bp = $req->getBusinessParams();

        $usage = $res->getUsage();
        if (! $usage) {
            $req->calculateTokenEstimates();
            $usage = new Usage(
                promptTokens: $req->getTotalTokenEstimate() ?? 0,
                completionTokens: 0,
                totalTokens: $req->getTotalTokenEstimate() ?? 0,
            );
        }

        $operationTime = (int) ($bp['operation_time'] ?? 0);
        $ak = (string) ($bp['ak'] ?? '');
        $accessTokenRaw = (string) ($bp['access_token_raw'] ?? '');

        $accessScope = $this->resolveAccessScopeForAudit($bp, $accessTokenRaw);
        $accessTokenName = $this->resolveAccessTokenName($accessTokenRaw);

        $businessParams = array_merge($bp, [
            'access_token_name' => $accessTokenName,
            'audit_source_marker' => 'processRequest',
            'request_id' => trim((string) ($bp['request_id'] ?? '')),
        ]);

        $detailInfo = InvocationDetailInfo::forModel(
            (string) ($bp['app_id'] ?? ''),
            (string) ($bp['source_id'] ?? ''),
            (string) ($bp['service_provider_model_id'] ?? ''),
            ['original_model_id' => (string) ($bp['original_model_id'] ?? '')],
        );

        AsyncEventUtil::dispatch(new ModelAuditReadyEvent(
            type: AuditType::EMBEDDING->value,
            productCode: (string) ($bp['model_id'] ?? $req->getModel()),
            status: AuditStatus::SUCCESS->value,
            ak: $ak,
            operationTime: $operationTime,
            allLatency: (int) $event->getDuration(),
            userInfo: [
                'organization_code' => (string) ($bp['organization_id'] ?? ''),
                'user_id' => (string) ($bp['user_id'] ?? ''),
                'user_name' => (string) ($bp['user_name'] ?? ''),
            ],
            usage: $usage->toArray(),
            detailInfo: $detailInfo,
            businessParams: $businessParams,
            accessScope: $accessScope,
            eventId: $this->resolveModelAuditEventId($businessParams),
        ));
    }

    /**
     * @param array<string, mixed> $businessParams
     */
    private function resolveModelAuditEventId(array $businessParams): string
    {
        $eventId = trim((string) ($businessParams['event_id'] ?? ''));
        if ($eventId !== '') {
            return $eventId;
        }

        $eventId = (string) IdGenerator::getSnowId();

        $this->logger->warning('ModelAuditEventIdMissingFallback', [
            'generated_event_id' => $eventId,
            'request_id' => trim((string) ($businessParams['request_id'] ?? '')),
            'audit_source_marker' => (string) ($businessParams['audit_source_marker'] ?? ''),
            'model_id' => (string) ($businessParams['model_id'] ?? ''),
            'service_provider_model_id' => (string) ($businessParams['service_provider_model_id'] ?? ''),
            'provider_model_id' => (string) ($businessParams['provider_model_id'] ?? ''),
            'app_id' => (string) ($businessParams['app_id'] ?? ''),
            'source_id' => (string) ($businessParams['source_id'] ?? ''),
            'organization_id' => (string) ($businessParams['organization_id'] ?? ''),
            'user_id' => (string) ($businessParams['user_id'] ?? ''),
        ]);

        return $eventId;
    }

    /**
     * 查库获取 access token 名称快照，供审计落库。
     * 若 token 为空或已删除则返回空字符串（与现网 async 路径边界一致）。
     */
    private function resolveAccessTokenName(string $accessToken): string
    {
        if ($accessToken === '') {
            return '';
        }
        $tokenEntity = $this->accessTokenDomainService->getByAccessToken($accessToken);
        return $tokenEntity?->getName() ?? '';
    }

    /**
     * User→开放平台，Application→Magic；无 token 字符串的会话类审计视为 Magic（与网关数据隔离约定一致）.
     * 必须完整保留 accessToken 查库 fallback，bingSearch 等工具类链路没有 access_token_type，依赖此逻辑判定 access_scope。
     */
    private function resolveAccessScopeForAudit(array $businessParams, string $accessToken): ModelAuditAccessScope
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

    private function mapOutcomeToAuditStatus(string $outcome): AuditStatus
    {
        return match (strtolower($outcome)) {
            'success' => AuditStatus::SUCCESS,
            default => AuditStatus::FAIL,
        };
    }
}
