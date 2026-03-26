<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Audit\ModelCall\Event\Subscribe;

use App\Application\Audit\ModelCall\Event\AuditLogEvent;
use App\Domain\Audit\ModelCall\Entity\AuditLogEntity;
use App\Domain\Audit\ModelCall\Factory\AuditLogFactory;
use App\Domain\Audit\ModelCall\Service\ModelCallAuditDomainService;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Odin\Event\AfterChatCompletionsStreamEvent;
use Psr\Log\LoggerInterface;
use Throwable;

#[Listener]
class AuditLogSubscriber implements ListenerInterface
{
    public function __construct(
        private readonly ModelCallAuditDomainService $modelCallAuditDomainService,
        private readonly LoggerInterface $logger
    ) {
    }

    public function listen(): array
    {
        return [
            AuditLogEvent::class,
            AfterChatCompletionsStreamEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if ($event instanceof AfterChatCompletionsStreamEvent) {
            $this->backfillStreamUsage($event);
            return;
        }
        if (! $event instanceof AuditLogEvent) {
            return;
        }

        try {
            $this->modelCallAuditDomainService->record(self::entityFromEvent($event));
        } catch (Throwable $throwable) {
            $this->logger->error('Model audit log save failed', [
                'event' => AuditLogEvent::class,
                'ip' => $event->ip,
                'type' => $event->type,
                'product_code' => $event->productCode,
                'status' => $event->status,
                'error' => $throwable->getMessage(),
            ]);
        }
    }

    private function backfillStreamUsage(AfterChatCompletionsStreamEvent $event): void
    {
        $completionRequest = $event->getCompletionRequest();
        $completionResponse = $event->getCompletionResponse();
        $usage = $completionResponse->getUsage();

        if (! $usage) {
            return;
        }

        $businessParams = $completionRequest->getBusinessParams();
        $requestId = (string) ($businessParams['request_id'] ?? '');
        if ($requestId === '') {
            return;
        }

        $productCode = (string) ($businessParams['model_id'] ?? $completionRequest->getModel());
        try {
            $this->modelCallAuditDomainService->backfillStreamUsageByRequestId(
                $requestId,
                $productCode,
                $usage->toArray()
            );
        } catch (Throwable $throwable) {
            $this->logger->error('Model audit log usage backfill failed', [
                'event' => AfterChatCompletionsStreamEvent::class,
                'request_id' => $requestId,
                'product_code' => $productCode,
                'error' => $throwable->getMessage(),
            ]);
        }
    }

    /**
     * 将 Application 事件装配为领域实体（避免 Domain 依赖 Application）.
     */
    private static function entityFromEvent(AuditLogEvent $event): AuditLogEntity
    {
        $userInfo = $event->userInfo;
        $userId = (string) ($userInfo['user_id'] ?? '');
        $organizationCode = (string) ($userInfo['organization_code'] ?? '');

        $raw = $event->businessParams['magic_topic_id'] ?? null;
        $magicTopicId = is_string($raw) ? trim($raw) : '';
        $magicTopicId = $magicTopicId === '' ? null : $magicTopicId;

        $requestRaw = $event->businessParams['request_id'] ?? null;
        $requestId = $requestRaw !== null && $requestRaw !== '' ? trim((string) $requestRaw) : '';
        $requestId = $requestId === '' ? null : $requestId;

        return AuditLogFactory::createNew(
            userId: $userId,
            organizationCode: $organizationCode,
            ip: $event->ip,
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
        );
    }
}
