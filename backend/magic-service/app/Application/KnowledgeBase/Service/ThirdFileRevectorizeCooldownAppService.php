<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Service;

use App\Application\KnowledgeBase\DTO\DataIsolationDTO;
use App\Application\KnowledgeBase\DTO\DocumentRequestDTO;
use App\Domain\KnowledgeBase\Port\DocumentGateway;
use App\Domain\KnowledgeBase\Service\ThirdFileRevectorizeCooldownDomainService;
use Psr\Log\LoggerInterface;
use Throwable;

class ThirdFileRevectorizeCooldownAppService
{
    public function __construct(
        private readonly ThirdFileRevectorizeCooldownDomainService $domainService,
        private readonly DocumentGateway $documentGateway,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function notify(DocumentRequestDTO $request): void
    {
        if (! $this->isValid($request)) {
            $this->documentGateway->reVectorizedByThirdFileId($request);
            return;
        }

        $shouldExecute = $this->domainService->recordNotification(
            $request->dataIsolation->organizationCode,
            (string) $request->thirdPlatformType,
            (string) $request->thirdFileId,
            $this->payloadFromRequest($request),
        );
        if ($shouldExecute) {
            $this->dispatch($request, 'immediate');
        }
    }

    public function dispatchDue(int $limit = 100): int
    {
        $dispatched = 0;
        foreach ($this->domainService->claimDuePayloads($limit) as $payload) {
            $request = $this->requestFromPayload($payload);
            try {
                $this->dispatch($request, 'cooldown');
                ++$dispatched;
            } catch (Throwable $throwable) {
                $this->logger->warning('Third-file cooldown dispatch failed', [
                    'third_platform_type' => $request->thirdPlatformType,
                    'third_file_id' => $request->thirdFileId,
                    'error' => $throwable->getMessage(),
                ]);
            }
        }
        return $dispatched;
    }

    private function dispatch(DocumentRequestDTO $request, string $reason): void
    {
        $this->documentGateway->reVectorizedByThirdFileId($request);
        $this->logger->info('Third-file revectorize notification dispatched', [
            'third_platform_type' => $request->thirdPlatformType,
            'third_file_id' => $request->thirdFileId,
            'reason' => $reason,
        ]);
    }

    private function isValid(DocumentRequestDTO $request): bool
    {
        return trim((string) $request->thirdPlatformType) !== ''
            && trim((string) $request->thirdFileId) !== ''
            && trim($request->dataIsolation->organizationCode) !== '';
    }

    private function payloadFromRequest(DocumentRequestDTO $request): array
    {
        return [
            'organization_code' => $request->dataIsolation->organizationCode,
            'user_id' => $request->dataIsolation->userId,
            'third_platform_user_id' => $request->dataIsolation->thirdPlatformUserId,
            'third_platform_organization_code' => $request->dataIsolation->thirdPlatformOrganizationCode,
            'third_platform_type' => $request->thirdPlatformType,
            'third_file_id' => $request->thirdFileId,
            'third_knowledge_id' => $request->thirdKnowledgeId,
        ];
    }

    private function requestFromPayload(array $payload): DocumentRequestDTO
    {
        return DocumentRequestDTO::forReVectorizedByThirdFileId(
            (string) ($payload['third_platform_type'] ?? ''),
            (string) ($payload['third_file_id'] ?? ''),
            new DataIsolationDTO(
                (string) ($payload['organization_code'] ?? ''),
                (string) ($payload['user_id'] ?? ''),
                (string) ($payload['third_platform_user_id'] ?? ''),
                (string) ($payload['third_platform_organization_code'] ?? ''),
            ),
            isset($payload['third_knowledge_id']) ? (string) $payload['third_knowledge_id'] : null,
        );
    }
}
