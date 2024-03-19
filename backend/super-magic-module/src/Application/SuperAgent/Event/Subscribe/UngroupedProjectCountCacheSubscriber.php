<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectCreatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectHiddenStatusUpdatedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectMovedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectsBatchDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectsBatchMovedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Clear ungrouped project count cache on project changes.
 */
#[Listener]
class UngroupedProjectCountCacheSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly ProjectDomainService $projectDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Events to listen.
     */
    public function listen(): array
    {
        return [
            ProjectCreatedEvent::class,
            ProjectDeletedEvent::class,
            ProjectHiddenStatusUpdatedEvent::class,
            ProjectMovedEvent::class,
            ProjectsBatchDeletedEvent::class,
            ProjectsBatchMovedEvent::class,
        ];
    }

    /**
     * Process project events to clear cache when needed.
     */
    public function process(object $event): void
    {
        try {
            match (true) {
                $event instanceof ProjectCreatedEvent => $this->handleSingleProject($event->getProjectEntity(), $event->getUserAuthorization()),
                $event instanceof ProjectDeletedEvent => $this->handleSingleProject($event->getProjectEntity(), $event->getUserAuthorization()),
                $event instanceof ProjectHiddenStatusUpdatedEvent => $this->handleHiddenStatusUpdated($event),
                $event instanceof ProjectMovedEvent => $this->handleSingleProject($event->getProjectEntity(), $event->getUserAuthorization()),
                $event instanceof ProjectsBatchDeletedEvent => $this->handleBatchProjects($event->getProjectEntities(), $event->getUserAuthorization()),
                $event instanceof ProjectsBatchMovedEvent => $this->handleBatchProjects($event->getProjectEntities(), $event->getUserAuthorization()),
                default => null,
            };
        } catch (Throwable $e) {
            // Log error but don't throw to avoid affecting main business logic
            $this->logger->error('Clear ungrouped project count cache failed', [
                'event' => get_class($event),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    private function handleSingleProject(ProjectEntity $projectEntity, MagicUserAuthorization $userAuthorization): void
    {
        $this->clearCacheByMode(
            $userAuthorization->getId(),
            $userAuthorization->getOrganizationCode(),
            $projectEntity->getProjectMode()
        );
    }

    /**
     * @param ProjectEntity[] $projectEntities
     */
    private function handleBatchProjects(array $projectEntities, MagicUserAuthorization $userAuthorization): void
    {
        $modes = [];
        foreach ($projectEntities as $projectEntity) {
            $mode = $this->normalizeProjectMode($projectEntity->getProjectMode());
            if ($mode !== null) {
                $modes[$mode->value] = $mode;
            }
        }

        foreach ($modes as $mode) {
            $this->clearCache($userAuthorization->getId(), $userAuthorization->getOrganizationCode(), $mode);
        }
    }

    private function clearCacheByMode(string $userId, string $organizationCode, ?string $projectMode): void
    {
        $mode = $this->normalizeProjectMode($projectMode);
        if ($mode === null) {
            return;
        }

        $this->clearCache($userId, $organizationCode, $mode);
    }

    private function handleHiddenStatusUpdated(ProjectHiddenStatusUpdatedEvent $event): void
    {
        $this->clearCacheByMode(
            $event->getUserId(),
            $event->getUserOrganizationCode(),
            $event->getProjectMode()
        );
    }

    private function clearCache(string $userId, string $organizationCode, ProjectMode $projectMode): void
    {
        $this->projectDomainService->clearUngroupedProjectCountCacheByMode(
            $userId,
            $organizationCode,
            $projectMode
        );
    }

    private function normalizeProjectMode(?string $projectMode): ?ProjectMode
    {
        if ($projectMode === null || $projectMode === '') {
            return null;
        }

        return ProjectMode::tryFrom($projectMode);
    }
}
