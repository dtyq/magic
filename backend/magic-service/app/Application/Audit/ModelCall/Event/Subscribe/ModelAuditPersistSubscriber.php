<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Audit\ModelCall\Event\Subscribe;

use App\Application\Audit\ModelCall\Event\ModelAuditReadyEvent;
use App\Domain\Audit\ModelCall\Entity\AuditLogEntity;
use App\Domain\Audit\ModelCall\Factory\AuditLogFactory;
use App\Domain\Audit\ModelCall\Service\ModelCallAuditDomainService;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 审计同步持久化订阅者：监听 ModelAuditReadyEvent，在 EventDispatcher 派发链路内一次性 INSERT。
 * 仅使用 #[Listener]（非 #[AsyncListener]），与 Bridge 的 dispatch 同调用栈完成落库。
 */
#[Listener]
class ModelAuditPersistSubscriber implements ListenerInterface
{
    public function __construct(
        private readonly ModelCallAuditDomainService $modelCallAuditDomainService,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function listen(): array
    {
        return [ModelAuditReadyEvent::class];
    }

    public function process(object $event): void
    {
        if (! $event instanceof ModelAuditReadyEvent) {
            return;
        }
        try {
            $this->modelCallAuditDomainService->record(self::buildEntityFromEvent($event));
        } catch (Throwable $e) {
            $this->logger->error('Model audit persist failed', [
                'type' => $event->type,
                'product_code' => $event->productCode,
                'status' => $event->status,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * 将 ModelAuditReadyEvent 装配为领域实体（避免 Domain 依赖 Application）.
     */
    private static function buildEntityFromEvent(ModelAuditReadyEvent $event): AuditLogEntity
    {
        $userInfo = $event->userInfo;
        $userId = (string) ($userInfo['user_id'] ?? '');
        $organizationCode = (string) ($userInfo['organization_code'] ?? '');

        $raw = $event->businessParams['magic_topic_id'] ?? null;
        $magicTopicId = is_string($raw) ? trim($raw) : '';
        $magicTopicId = $magicTopicId === '' ? null : $magicTopicId;

        // request_id 为可选透传字段：有则写入，无则保持空字符串
        $requestId = trim((string) ($event->businessParams['request_id'] ?? ''));

        $accessTokenName = trim((string) ($event->businessParams['access_token_name'] ?? ''));
        $modelVersion = trim((string) ($event->businessParams['model_version'] ?? ''));
        $providerName = trim((string) ($event->businessParams['provider_name'] ?? ''));

        $eventId = trim($event->eventId);

        return AuditLogFactory::createNew(
            userId: $userId,
            organizationCode: $organizationCode,
            type: $event->type,
            productCode: $event->productCode,
            status: $event->status,
            ak: $event->ak,
            operationTime: $event->operationTime,
            allLatency: $event->allLatency,
            usage: $event->usage,
            detailInfo: $event->detailInfo,
            accessScope: $event->accessScope,
            magicTopicId: $magicTopicId,
            requestId: $requestId,
            accessTokenName: $accessTokenName,
            modelVersion: $modelVersion,
            providerName: $providerName,
            firstResponseLatency: $event->firstResponseLatency,
            eventId: $eventId !== '' ? $eventId : null,
        );
    }
}
