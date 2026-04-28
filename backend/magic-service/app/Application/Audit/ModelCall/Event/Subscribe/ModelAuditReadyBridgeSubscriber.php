<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Audit\ModelCall\Event\Subscribe;

use App\Application\ModelGateway\Event\ImageSearchUsageEvent;
use App\Application\ModelGateway\Event\ModelUsageEvent;
use App\Application\ModelGateway\Event\WebSearchUsageEvent;
use App\Application\ModelGateway\Support\InvocationDetailInfo;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditStatus;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditType;
use App\Domain\Audit\ModelCall\Entity\ValueObject\ModelAuditAccessScope;
use App\Domain\Audit\ModelCall\Factory\AuditLogFactory;
use App\Domain\Audit\ModelCall\Service\ModelCallAuditDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Event\ImageGeneratedEvent;
use App\Domain\ModelGateway\Event\ImageGenerateFailedEvent;
use App\Domain\ModelGateway\Event\VideoGeneratedEvent;
use App\Domain\ModelGateway\Event\VideoGenerateFailedEvent;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Odin\Api\Response\Usage;
use Hyperf\Odin\Event\AfterChatCompletionsEvent;
use Hyperf\Odin\Event\AfterChatCompletionsStreamEvent;
use Hyperf\Odin\Event\AfterEmbeddingsEvent;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 统一模型调用审计监听器：监听所有业务事件和 Odin 后置事件，
 * 组装审计快照并直接持久化。经 dtyq/async-event 异步执行，不阻塞主链路。
 */
#[AsyncListener(driver: 'coroutine')]
#[Listener]
class ModelAuditReadyBridgeSubscriber implements ListenerInterface
{
    public function __construct(
        private readonly ModelCallAuditDomainService $modelCallAuditDomainService,
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

        $auditType = match ((string) ($businessParams['model_type'] ?? '')) {
            'embedding' => AuditType::EMBEDDING,
            'image' => AuditType::IMAGE,
            default => AuditType::TEXT,
        };
        $accessScope = $this->resolveAccessScopeForAudit($businessParams);
        $businessParams = array_merge($businessParams, [
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

        $this->persistAudit(
            type: $auditType->value,
            productCode: (string) ($businessParams['model_id'] ?? $event->getModelId()),
            status: AuditStatus::FAIL->value,
            ak: (string) ($businessParams['ak'] ?? ''),
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
        );
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
        $accessScope = $this->resolveAccessScopeForAudit($bp);
        $chain = (string) ($bp['chain'] ?? '');
        $businessParams = array_merge($bp, [
            'audit_source_marker' => $chain,
            'request_id' => trim((string) ($bp['request_id'] ?? '')),
        ]);

        $status = (($bp['status'] ?? '') === AuditStatus::SUCCESS->value)
            ? AuditStatus::SUCCESS
            : AuditStatus::FAIL;
        $extras = [
            'chain' => $chain,
            'original_model_id' => (string) ($bp['original_model_id'] ?? ''),
        ];
        if ($status->isFail()) {
            $extras = InvocationDetailInfo::withFailureReason($extras, (string) ($bp['failure_reason'] ?? ''));
        }
        $detailInfo = InvocationDetailInfo::forModel(
            (string) ($bp['app_id'] ?? ''),
            (string) ($bp['source_id'] ?? ''),
            (string) ($bp['provider_model_id'] ?? ''),
            $extras,
        );

        $usage = $this->buildImageGeneratedUsage($event, $status, $bp);

        $this->persistAudit(
            type: AuditType::IMAGE->value,
            productCode: (string) ($bp['model_id'] ?? ''),
            status: $status->value,
            ak: (string) ($bp['ak'] ?? ''),
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
        );
    }

    private function buildImageGeneratedUsage(ImageGeneratedEvent $event, AuditStatus $status, array $businessParams): array
    {
        if ($status->isFail()) {
            return [];
        }

        $usage = ['count' => (int) ($businessParams['image_count'] ?? 0)];
        $tokenUsage = $event->getUsage();
        if ($tokenUsage === null || $tokenUsage->getTotalTokens() <= 0) {
            return $usage;
        }

        return array_merge($usage, $tokenUsage->toArray());
    }

    private function processImageGenerateFailed(ImageGenerateFailedEvent $event): void
    {
        $bp = $event->getBusinessParams();
        $accessScope = $this->resolveAccessScopeForAudit($bp);
        $chain = (string) ($bp['chain'] ?? '');
        $businessParams = array_merge($bp, [
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

        $this->persistAudit(
            type: AuditType::IMAGE->value,
            productCode: $event->getModel(),
            status: AuditStatus::FAIL->value,
            ak: (string) ($bp['ak'] ?? ''),
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
        );
    }

    private function processVideoGenerated(VideoGeneratedEvent $event): void
    {
        $bp = $event->getBusinessParams();
        $accessScope = $this->resolveAccessScopeForAudit($bp);
        $originalModelId = (string) ($bp['original_model_id'] ?? ($event->getOriginalModelId() ?? $event->getModel()));
        $businessParams = $bp;
        $businessParams['audit_source_marker'] = 'videoGenerate';
        $businessParams['request_id'] = trim((string) ($bp['request_id'] ?? ''));

        $detailInfo = InvocationDetailInfo::forModel(
            (string) ($bp['app_id'] ?? ''),
            (string) ($bp['source_id'] ?? ''),
            (string) ($bp['provider_model_id'] ?? $event->getProviderModelId()),
            ['original_model_id' => $originalModelId],
        );

        // 视频默认带次数与成片时长；若事件含 provider token 用量则一并写入，与对话类审计结构对齐供计费回写
        $usage = [
            'count' => 1,
            'duration_seconds' => $event->getDurationSeconds(),
        ];
        $completionTokens = $event->getCompletionTokens();
        $totalTokens = $event->getTotalTokens();
        if ($completionTokens !== null && $completionTokens > 0) {
            $usage['completion_tokens'] = $completionTokens;
            $resolvedTotal = $totalTokens ?? $completionTokens;
            $usage['total_tokens'] = $resolvedTotal;
        }

        $this->persistAudit(
            type: AuditType::VIDEO->value,
            productCode: (string) ($bp['model_id'] ?? $event->getModel()),
            status: AuditStatus::SUCCESS->value,
            ak: (string) ($bp['ak'] ?? ''),
            operationTime: (int) ($bp['operation_time'] ?? 0),
            allLatency: (int) ($bp['response_duration'] ?? 0),
            userInfo: [
                'organization_code' => (string) ($bp['organization_id'] ?? $event->getOrganizationCode()),
                'user_id' => (string) ($bp['user_id'] ?? $event->getUserId()),
                'user_name' => (string) ($bp['user_name'] ?? ''),
            ],
            usage: $usage,
            detailInfo: $detailInfo,
            businessParams: $businessParams,
            accessScope: $accessScope,
            eventId: $this->resolveModelAuditEventId($businessParams),
        );
    }

    private function processVideoGenerateFailed(VideoGenerateFailedEvent $event): void
    {
        $bp = $event->getBusinessParams();
        $accessScope = $this->resolveAccessScopeForAudit($bp);
        $originalModelId = (string) ($bp['original_model_id'] ?? $event->getModel());
        $businessParams = $bp;
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

        $this->persistAudit(
            type: AuditType::VIDEO->value,
            productCode: (string) ($bp['model_id'] ?? $event->getModel()),
            status: AuditStatus::FAIL->value,
            ak: (string) ($bp['ak'] ?? ''),
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
        );
    }

    private function dispatchSearchAudit(array $businessParams): void
    {
        $accessScope = $this->resolveAccessScopeForAudit($businessParams);
        $chain = (string) ($businessParams['chain'] ?? '');
        $engineName = (string) ($businessParams['engine'] ?? '');
        $businessParams = array_merge($businessParams, [
            'model_version' => '',
            'provider_name' => '',
            'audit_source_marker' => $chain,
            'request_id' => trim((string) ($businessParams['request_id'] ?? '')),
        ]);

        $status = (($businessParams['status'] ?? '') === AuditStatus::SUCCESS->value)
            ? AuditStatus::SUCCESS
            : AuditStatus::FAIL;
        $extras = [];
        if ($status->isFail()) {
            $extras = InvocationDetailInfo::withFailureReason([], (string) ($businessParams['failure_reason'] ?? ''));
        }
        $detailInfo = InvocationDetailInfo::forTool(
            (string) ($businessParams['app_id'] ?? ''),
            (string) ($businessParams['source_id'] ?? ''),
            $engineName,
            (string) ($businessParams['query'] ?? ''),
            $extras,
        );

        $usage = $status->isSuccess() ? ['count' => 1] : [];

        $this->persistAudit(
            type: AuditType::SEARCH->value,
            productCode: $engineName,
            status: $status->value,
            ak: (string) ($businessParams['ak'] ?? ''),
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
        );
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

        $accessScope = $this->resolveAccessScopeForAudit($bp);

        $businessParams = array_merge($bp, [
            'audit_source_marker' => 'processRequest',
            'request_id' => trim((string) ($bp['request_id'] ?? '')),
        ]);

        $detailInfo = InvocationDetailInfo::forModel(
            (string) ($bp['app_id'] ?? ''),
            (string) ($bp['source_id'] ?? ''),
            (string) ($bp['service_provider_model_id'] ?? ''),
            ['original_model_id' => (string) ($bp['original_model_id'] ?? '')],
        );

        $this->persistAudit(
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
        );
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

        $accessScope = $this->resolveAccessScopeForAudit($bp);

        $businessParams = array_merge($bp, [
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
        $this->persistAudit(
            type: AuditType::TEXT->value,
            productCode: (string) ($bp['model_id'] ?? $req->getModel()),
            status: AuditStatus::SUCCESS->value,
            ak: $ak,
            operationTime: $operationTime,
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
        );
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

        $accessScope = $this->resolveAccessScopeForAudit($bp);

        $businessParams = array_merge($bp, [
            'audit_source_marker' => 'processRequest',
            'request_id' => trim((string) ($bp['request_id'] ?? '')),
        ]);

        $detailInfo = InvocationDetailInfo::forModel(
            (string) ($bp['app_id'] ?? ''),
            (string) ($bp['source_id'] ?? ''),
            (string) ($bp['service_provider_model_id'] ?? ''),
            ['original_model_id' => (string) ($bp['original_model_id'] ?? '')],
        );

        $this->persistAudit(
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
        );
    }

    /**
     * 审计落库：组装实体并持久化。
     *
     * @param array<string, mixed> $userInfo
     * @param array<string, mixed> $usage
     * @param null|array<string, mixed> $detailInfo
     * @param array<string, mixed> $businessParams
     */
    private function persistAudit(
        string $type,
        string $productCode,
        string $status,
        string $ak,
        int $operationTime,
        int $allLatency,
        array $userInfo,
        array $usage,
        ?array $detailInfo,
        array $businessParams,
        ModelAuditAccessScope $accessScope,
        int $firstResponseLatency = 0,
        string $eventId = '',
    ): void {
        try {
            $userId = (string) ($userInfo['user_id'] ?? '');
            $organizationCode = (string) ($userInfo['organization_code'] ?? '');

            $raw = $businessParams['magic_topic_id'] ?? null;
            $magicTopicId = is_string($raw) ? trim($raw) : '';
            $magicTopicId = $magicTopicId === '' ? null : $magicTopicId;

            $requestId = trim((string) ($businessParams['request_id'] ?? ''));
            $accessTokenName = trim((string) ($businessParams['access_token_name'] ?? ''));
            $modelVersion = trim((string) ($businessParams['model_version'] ?? ''));
            $providerName = trim((string) ($businessParams['provider_name'] ?? ''));
            $eventId = trim($eventId);

            $entity = AuditLogFactory::createNew(
                userId: $userId,
                organizationCode: $organizationCode,
                type: $type,
                productCode: $productCode,
                status: $status,
                ak: $ak,
                operationTime: $operationTime,
                allLatency: $allLatency,
                usage: $usage,
                detailInfo: $detailInfo,
                accessScope: $accessScope,
                magicTopicId: $magicTopicId,
                requestId: $requestId,
                accessTokenName: $accessTokenName,
                modelVersion: $modelVersion,
                providerName: $providerName,
                firstResponseLatency: $firstResponseLatency,
                eventId: $eventId !== '' ? $eventId : null,
            );

            $this->modelCallAuditDomainService->record($entity);
        } catch (Throwable $e) {
            $this->logger->error('Model audit persist failed', [
                'type' => $type,
                'product_code' => $productCode,
                'status' => $status,
                'error' => $e->getMessage(),
            ]);
        }
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
     * User→开放平台，Application→Magic；无 type 则缺省 Magic。
     *
     * @param array<string, mixed> $businessParams
     */
    private function resolveAccessScopeForAudit(array $businessParams): ModelAuditAccessScope
    {
        $tokenType = (string) ($businessParams['access_token_type'] ?? '');
        if ($tokenType === AccessTokenType::User->value) {
            return ModelAuditAccessScope::ApiPlatform;
        }
        if ($tokenType === AccessTokenType::Application->value) {
            return ModelAuditAccessScope::Magic;
        }
        return ModelAuditAccessScope::Magic;
    }
}
