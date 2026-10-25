<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Project\Event\Subscribe;

use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Event\ProjectCreatedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectDeletedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectHiddenStatusUpdatedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectMovedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectsBatchDeletedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectsBatchMovedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectTransferredEvent;
use App\Domain\SuperMagic\Project\Event\ProjectUpdatedEvent;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
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
            ProjectTransferredEvent::class,
            ProjectUpdatedEvent::class,
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
                $event instanceof ProjectTransferredEvent => $this->handleTransferred($event),
                $event instanceof ProjectUpdatedEvent => $this->handleSingleProject($event->getProjectEntity(), $event->getUserAuthorization()),
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
        $this->clearAudioCache(
            $projectEntity->getUserId() ?: $userAuthorization->getId(),
            $projectEntity->getUserOrganizationCode() ?: $userAuthorization->getOrganizationCode()
        );
    }

    /**
     * @param ProjectEntity[] $projectEntities
     */
    private function handleBatchProjects(array $projectEntities, MagicUserAuthorization $userAuthorization): void
    {
        if ($projectEntities === []) {
            return;
        }

        $scopes = [];
        foreach ($projectEntities as $projectEntity) {
            $userId = $projectEntity->getUserId() ?: $userAuthorization->getId();
            $organizationCode = $projectEntity->getUserOrganizationCode() ?: $userAuthorization->getOrganizationCode();
            $scopes[$userId . ':' . $organizationCode] = [$userId, $organizationCode];
        }

        foreach ($scopes as [$userId, $organizationCode]) {
            $this->clearAudioCache($userId, $organizationCode);
        }
    }

    private function handleTransferred(ProjectTransferredEvent $event): void
    {
        $organizationCode = $event->getOrganizationCode();
        $this->clearAudioCache($event->getFromUserId(), $organizationCode);

        if ($event->getToUserId() !== $event->getFromUserId()) {
            $this->clearAudioCache($event->getToUserId(), $organizationCode);
        }
    }

    private function handleHiddenStatusUpdated(ProjectHiddenStatusUpdatedEvent $event): void
    {
        $this->clearAudioCache(
            $event->getUserId(),
            $event->getUserOrganizationCode()
        );
    }

    private function clearAudioCache(string $userId, string $organizationCode): void
    {
        $this->projectDomainService->clearUngroupedProjectCountCacheByMode(
            $userId,
            $organizationCode,
            ProjectMode::AUDIO
        );
    }
}
