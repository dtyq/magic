<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Event\Subscribe;

use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Rpc\JsonRpc\Client\Knowledge\ProjectFileRpcClient;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileContentSavedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileMovedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileRenamedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FilesBatchDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileUploadedEvent;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Throwable;

#[AsyncListener]
#[Listener]
class ProjectFileChangeNotifySubscriber implements ListenerInterface
{
    use HasLogger;

    public function __construct(
        private readonly ProjectFileRpcClient $projectFileRpcClient,
    ) {
    }

    public function listen(): array
    {
        return [
            FileUploadedEvent::class,
            FileContentSavedEvent::class,
            FileDeletedEvent::class,
            FilesBatchDeletedEvent::class,
            FileRenamedEvent::class,
            FileMovedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if ($event instanceof FilesBatchDeletedEvent) {
            $this->processBatchDeleted($event);
            return;
        }

        $context = $this->extractContext($event);
        if ($context === null) {
            return;
        }

        $fileEntity = $context['file_entity'];
        $projectFileId = $fileEntity->getFileId();
        if ($projectFileId <= 0 || $fileEntity->getIsDirectory()) {
            return;
        }

        $this->notifyProjectFileChange(
            $projectFileId,
            $context['organization_code'],
            $fileEntity->getProjectId(),
            $context['status'],
            [
                'project_id' => $fileEntity->getProjectId(),
                'file_key' => $fileEntity->getFileKey(),
                'user_id' => $context['user_id'],
                'organization_code' => $context['organization_code'],
                'event' => $event::class,
            ],
        );
    }

    private function processBatchDeleted(FilesBatchDeletedEvent $event): void
    {
        $authorization = $event->getUserAuthorization();
        foreach ($event->getFileIds() as $fileId) {
            $projectFileId = (int) $fileId;
            if ($projectFileId <= 0) {
                continue;
            }

            $this->notifyProjectFileChange(
                $projectFileId,
                $authorization->getOrganizationCode(),
                $event->getProjectId(),
                'deleted',
                [
                    'project_id' => $event->getProjectId(),
                    'user_id' => $authorization->getId(),
                    'organization_code' => $authorization->getOrganizationCode(),
                    'event' => $event::class,
                ],
            );
        }
    }

    /**
     * @return null|array{file_entity: TaskFileEntity, user_id: string, organization_code: string, status: null|string}
     */
    private function extractContext(object $event): ?array
    {
        return match (true) {
            $event instanceof FileUploadedEvent,
            $event instanceof FileContentSavedEvent => [
                'file_entity' => $event->getFileEntity(),
                'user_id' => $event->getUserId(),
                'organization_code' => $event->getOrganizationCode(),
                'status' => null,
            ],
            $event instanceof FileDeletedEvent => [
                'file_entity' => $event->getFileEntity(),
                'user_id' => $event->getUserId(),
                'organization_code' => $event->getOrganizationCode(),
                'status' => 'deleted',
            ],
            $event instanceof FileRenamedEvent,
            $event instanceof FileMovedEvent => $this->buildAuthorizationContext(
                $event->getFileEntity(),
                $event->getUserAuthorization(),
            ),
            default => null,
        };
    }

    /**
     * @return array{file_entity: TaskFileEntity, user_id: string, organization_code: string, status: null|string}
     */
    private function buildAuthorizationContext(
        TaskFileEntity $fileEntity,
        MagicUserAuthorization $authorization,
    ): array {
        return [
            'file_entity' => $fileEntity,
            'user_id' => $authorization->getId(),
            'organization_code' => $authorization->getOrganizationCode(),
            'status' => null,
        ];
    }

    private function notifyProjectFileChange(
        int $projectFileId,
        string $organizationCode,
        int $projectId,
        ?string $status,
        array $logContext,
    ): void {
        try {
            if ($status === null) {
                $this->projectFileRpcClient->notifyChange($projectFileId);
            } else {
                $this->projectFileRpcClient->notifyChange($projectFileId, $organizationCode, $projectId, $status);
            }
        } catch (Throwable $throwable) {
            $this->logger->error('Failed to notify project file change', [
                ...$logContext,
                'project_file_id' => $projectFileId,
                'status' => $status,
                'error' => $throwable->getMessage(),
            ]);
        }
    }
}
