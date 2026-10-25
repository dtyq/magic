<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Project\Service;

use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\Common\Share\Constant\ResourceType;
use App\Domain\SuperMagic\Common\Share\Constant\ShareAccessType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MicroAppPublishStatus;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Workspace\Entity\ValueObject\WorkspaceType;
use App\Domain\SuperMagic\Workspace\Repository\Facade\WorkspaceRepositoryInterface;

/** Read access to an organization's published project, without membership. */
class PublishedMicroAppFileAccessService
{
    public function __construct(
        private readonly MicroAppRepositoryInterface $microAppRepository,
        private readonly ProjectRepositoryInterface $projectRepository,
        private readonly PublishedMicroAppResolver $publishedMicroAppResolver,
        private readonly TaskFileRepositoryInterface $taskFileRepository,
        private readonly WorkspaceRepositoryInterface $workspaceRepository,
    ) {
    }

    public static function supportsShare(MicroAppEntity $record, ProjectEntity $project, ResourceShareEntity $share, string $organizationCode): bool
    {
        return $organizationCode !== ''
            && $record->getPublishStatus() === MicroAppPublishStatus::Published->value
            && $record->getDeletedAt() === null
            && $project->getDeletedAt() === null
            && $project->getId() > 0
            && $record->getProjectId() === $project->getId()
            && $record->getOrganizationCode() === $organizationCode
            && $project->getUserOrganizationCode() === $organizationCode
            && $share->getOrganizationCode() === $organizationCode
            && in_array($share->getShareType(), [ShareAccessType::TeamShare->value, ShareAccessType::Internet->value], true)
            && ! $share->getIsPasswordEnabled()
            && $share->getResourceType() === ResourceType::Project->value
            && $share->isShareProject()
            && $share->getIsEnabled()
            && $share->isValid()
            && $record->getResourceId() !== ''
            && $record->getResourceId() === $share->getResourceId()
            && $share->getProjectId() === (string) $project->getId();
    }

    public function canAccessProject(int $projectId, string $userId, string $organizationCode): bool
    {
        if ($projectId <= 0 || $userId === '' || $organizationCode === '') {
            return false;
        }
        $record = $this->microAppRepository->findByProjectId($projectId);
        $project = $this->projectRepository->findById($projectId);
        if ($record === null || $project === null) {
            return false;
        }
        $published = $this->publishedMicroAppResolver->findPublished($record->getId());
        if ($published === null || $published[0]->getId() !== $record->getId()
            || ! self::supportsShare($published[0], $project, $published[1], $organizationCode)) {
            return false;
        }
        if ($project->getProjectMode() !== ProjectMode::MICRO_APP->value) {
            $workspaceId = $project->getWorkspaceId();
            $workspace = $workspaceId === null ? null : $this->workspaceRepository->getWorkspaceById($workspaceId);
            if ($workspace === null || $workspace->getWorkspaceType() !== WorkspaceType::MicroApp->value) {
                return false;
            }
        }
        return $this->publishedMicroAppResolver->canAccessShare($published[1], $userId, $organizationCode);
    }

    /**
     * Context belongs to one read operation only, never to a service or sandbox.
     * Callers may seed context['files'] with entities fetched in that operation.
     */
    public function canAccessFile(TaskFileEntity $file, string $userId, string $organizationCode, array &$context = []): bool
    {
        $actor = [$userId, $organizationCode];
        if (isset($context['actor']) && $context['actor'] !== $actor) {
            $context = [];
        }
        $context['actor'] = $actor;
        $projectId = $file->getProjectId();
        if (! $this->isProjectFile($file, $projectId, $organizationCode)) {
            return false;
        }
        $context['projects'][$projectId] ??= $this->canAccessProject($projectId, $userId, $organizationCode);
        if (! $context['projects'][$projectId]) {
            return false;
        }
        if (! array_key_exists($projectId, $context['roots'] ?? [])) {
            $context['roots'][$projectId] = $this->taskFileRepository->findRootDirectoryByProjectId($projectId);
        }
        $root = $context['roots'][$projectId];
        if ($root === null || ! $root->getIsDirectory() || ($root->getParentId() ?? 0) !== 0
            || ! $this->isProjectFile($root, $projectId, $organizationCode)) {
            return false;
        }

        $visited = [];
        $current = $file;
        while (true) {
            $fileId = $current->getFileId();
            if (isset($visited[$fileId]) || ! $this->isProjectFile($current, $projectId, $organizationCode)) {
                return false;
            }
            $visited[$fileId] = true;
            if ($fileId === $root->getFileId() || isset($context['connected'][$projectId][$fileId])) {
                foreach ($visited as $id => $_) {
                    $context['connected'][$projectId][$id] = true;
                }
                return true;
            }
            $parentId = $current->getParentId();
            if ($parentId === null || $parentId <= 0) {
                return false;
            }
            if (! array_key_exists($parentId, $context['files'] ?? [])) {
                $context['files'][$parentId] = $parentId === $root->getFileId()
                    ? $root : $this->taskFileRepository->getById($parentId);
            }
            $current = $context['files'][$parentId];
            if ($current === null || ! $current->getIsDirectory()) {
                return false;
            }
        }
    }

    private function isProjectFile(TaskFileEntity $file, int $projectId, string $organizationCode): bool
    {
        return $file->getFileId() > 0
            && $projectId > 0
            && $file->getProjectId() === $projectId
            && $file->getOrganizationCode() === $organizationCode
            && $file->getDeletedAt() === null
            && $file->getSpaceType() === FileSpaceType::PROJECT->value
            && $file->getStorageType() === StorageType::WORKSPACE;
    }
}
