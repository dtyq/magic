<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Service;

use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;

use function Hyperf\Translation\trans;

/**
 * Batch task-file authorization shared by file and share application services.
 */
class TaskFileAuthorizationService extends AbstractAppService
{
    public function __construct(
        private readonly TaskFileDomainService $taskFileDomainService,
    ) {
    }

    /**
     * Load and authorize every requested file, checking each project only once.
     *
     * @param array<int|string> $fileIds
     * @return TaskFileEntity[]
     */
    public function authorizeFilesByIds(
        MagicUserAuthorization $authorization,
        array $fileIds,
        MemberRole $requiredRole = MemberRole::VIEWER,
        bool $allowUserSpace = true,
    ): array {
        $normalizedIds = [];
        foreach ($fileIds as $fileId) {
            if ((! is_int($fileId) && ! is_string($fileId))
                || ! ctype_digit((string) $fileId)
                || (int) $fileId <= 0) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_PERMISSION_DENIED,
                    trans('file.file_permission_denied')
                );
            }
            $normalizedIds[(int) $fileId] = true;
        }
        $requestedIds = array_keys($normalizedIds);

        if (empty($requestedIds)) {
            return [];
        }

        $entities = $this->taskFileDomainService->getFilesByIds($requestedIds);
        $resolvedIds = array_map(
            static fn (TaskFileEntity $entity): int => $entity->getFileId(),
            $entities
        );
        sort($requestedIds);
        sort($resolvedIds);

        if ($requestedIds !== $resolvedIds) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_NOT_FOUND,
                trans('file.file_not_found')
            );
        }

        $projectIds = [];
        foreach ($entities as $entity) {
            if (! $entity->isProjectFile()) {
                if (! $allowUserSpace || ! $this->hasTaskFileOwnerPermission($entity, $authorization)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
                }
                continue;
            }

            $projectIds[$entity->getProjectId()] = true;
        }

        foreach (array_keys($projectIds) as $projectId) {
            $this->getAccessibleProject(
                (int) $projectId,
                $authorization->getId(),
                $authorization->getOrganizationCode(),
                $requiredRole,
            );
        }

        return $entities;
    }
}
