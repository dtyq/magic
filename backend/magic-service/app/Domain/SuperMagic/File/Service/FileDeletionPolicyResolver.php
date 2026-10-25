<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\File\Service;

use App\Application\Speech\Enum\AsrTopicModeEnum;
use App\Domain\SuperMagic\Common\Event\DeleteEventSource;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Enum\FileDeletionPolicy;
use App\Domain\SuperMagic\Task\Repository\Facade\TaskRepositoryInterface;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;

class FileDeletionPolicyResolver
{
    public function __construct(
        private readonly TaskRepositoryInterface $taskRepository,
        private readonly TopicDomainService $topicDomainService
    ) {
    }

    public function resolve(
        TaskFileEntity $file,
        DeleteEventSource $source,
        ?FileDeletionPolicyContext $context = null
    ): FileDeletionPolicy {
        if (in_array($source, [DeleteEventSource::InternalOverwrite, DeleteEventSource::SystemSync], true)) {
            return FileDeletionPolicy::PhysicalDelete;
        }

        if ($file->isProjectFile() && $context?->isUnderRootHiddenDirectory((int) $file->getFileId())) {
            return FileDeletionPolicy::PhysicalDelete;
        }

        if (! $file->isProjectFile() || $file->getTopicId() <= 0 || $file->getTaskId() <= 0) {
            return FileDeletionPolicy::RecycleBin;
        }

        $task = $context?->task($file->getTaskId()) ?? $this->taskRepository->getTaskById($file->getTaskId());
        $topic = $context?->topic($file->getTopicId()) ?? $this->topicDomainService->getTopicById($file->getTopicId());
        if ($task === null || $topic === null
            || $task->getTopicId() !== $file->getTopicId()
            || $task->getProjectId() !== $file->getProjectId()
            || $topic->getTopicMode() !== AsrTopicModeEnum::AUDIO_MERGE->value) {
            return FileDeletionPolicy::RecycleBin;
        }

        return FileDeletionPolicy::PhysicalDelete;
    }
}
