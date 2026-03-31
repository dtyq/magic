<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Audit\ModelCall\Event\Subscribe;

use App\Application\Audit\ModelCall\Service\AuditService;
use App\Application\ModelGateway\Event\ModelInvocationCompletedEvent;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditStatus;
use App\Domain\Audit\ModelCall\Entity\ValueObject\AuditType;
use App\Domain\Audit\ModelCall\Entity\ValueObject\ModelAuditAccessScope;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Service\AccessTokenDomainService;
use Hyperf\Context\Context;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;

#[Listener]
class ModelInvocationCompletedAuditListener implements ListenerInterface
{
    private const string AUDIT_DISPATCHED_KEYS = 'model_gateway.audit.dispatched_keys';

    public function __construct(
        private readonly AuditService $auditService,
        private readonly AccessTokenDomainService $accessTokenDomainService,
    ) {
    }

    public function listen(): array
    {
        return [
            ModelInvocationCompletedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof ModelInvocationCompletedEvent) {
            return;
        }

        $auditType = $this->mapInvocationCategoryToAuditType($event->invocationCategory);
        $auditStatus = $this->mapOutcomeToAuditStatus($event->outcome);

        $dispatchBusinessParams = $event->businessParams;
        if ($event->sourceMarker !== '') {
            $dispatchBusinessParams['audit_source_marker'] = $event->sourceMarker;
        }

        $accessScope = $this->resolveAccessScopeForAudit($dispatchBusinessParams, $event->accessToken);
        $dispatchKey = $this->buildAuditDispatchKey($auditType, $dispatchBusinessParams);

        if ($dispatchKey === '') {
            $this->auditService->dispatchAuditEvent(
                userInfo: $event->userInfo,
                ip: $event->ip,
                type: $auditType,
                productCode: $event->productCode,
                accessToken: $event->accessToken,
                startTime: $event->startTime,
                latencyMs: $event->latencyMs,
                status: $auditStatus,
                usage: $event->usage,
                detailInfo: $event->detailInfo,
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
            userInfo: $event->userInfo,
            ip: $event->ip,
            type: $auditType,
            productCode: $event->productCode,
            accessToken: $event->accessToken,
            startTime: $event->startTime,
            latencyMs: $event->latencyMs,
            status: $auditStatus,
            usage: $event->usage,
            detailInfo: $event->detailInfo,
            businessParams: $dispatchBusinessParams,
            accessScope: $accessScope,
        );
    }

    private function mapInvocationCategoryToAuditType(string $invocationCategory): AuditType
    {
        return AuditType::tryFrom($invocationCategory) ?? AuditType::TEXT;
    }

    private function mapOutcomeToAuditStatus(string $outcome): AuditStatus
    {
        return match (strtolower($outcome)) {
            'success' => AuditStatus::SUCCESS,
            default => AuditStatus::FAIL,
        };
    }

    /**
     * User→开放平台，Application→Magic；无 token 字符串的会话类审计视为 Magic（与网关数据隔离约定一致）.
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

    private function buildAuditDispatchKey(AuditType $type, array $businessParams = []): string
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
}
