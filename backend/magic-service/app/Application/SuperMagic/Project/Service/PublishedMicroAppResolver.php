<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Project\Service;

use App\Domain\File\Service\FileDomainService;
use App\Domain\SuperMagic\Common\Share\Constant\ShareAccessType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Common\Share\Service\ResourceShareDomainService;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MicroAppPublishStatus;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Throwable;

class PublishedMicroAppResolver
{
    private const INSTALL_ICON_FILE = 'icon.svg';

    public function __construct(
        private readonly MicroAppRepositoryInterface $microAppRepository,
        private readonly ProjectRepositoryInterface $projectRepository,
        private readonly ResourceShareDomainService $resourceShareDomainService,
        private readonly TaskFileRepositoryInterface $taskFileRepository,
        private readonly FileDomainService $fileDomainService,
    ) {
    }

    /**
     * @return null|array{0: MicroAppEntity, 1: ResourceShareEntity}
     */
    public function findPublished(int $appId): ?array
    {
        $record = $this->microAppRepository->findById($appId);
        if ($record === null || $record->getPublishStatus() !== MicroAppPublishStatus::Published->value) {
            return null;
        }

        $shareEntity = $this->resourceShareDomainService->getValidShareByResourceId($record->getResourceId());
        if ($shareEntity === null) {
            return null;
        }

        return [$record, $shareEntity];
    }

    /**
     * Org/team/internet published shares are visible without membership.
     * Password shares stay collaborator-only.
     */
    public function canAccessPublishedShare(int $appId, string $userId, string $organizationCode): bool
    {
        $publishedMicroApp = $this->findPublished($appId);
        if ($publishedMicroApp === null) {
            return false;
        }

        [, $shareEntity] = $publishedMicroApp;
        if ($shareEntity->getShareType() === ShareAccessType::PasswordProtected->value) {
            return false;
        }

        return $this->canAccessShare($shareEntity, $userId, $organizationCode);
    }

    public function canAccessShare(ResourceShareEntity $shareEntity, string $userId, string $organizationCode): bool
    {
        try {
            $this->resourceShareDomainService->validateShareAccess(
                $shareEntity,
                $userId,
                $organizationCode,
                $shareEntity->getShareCode()
            );
            return true;
        } catch (Throwable) {
            return false;
        }
    }

    public function getProjectName(int $appId): string
    {
        $publishedMicroApp = $this->findPublished($appId);
        if ($publishedMicroApp === null) {
            return '';
        }

        [$record] = $publishedMicroApp;
        return $this->getProjectNameFromRecord($record);
    }

    public function getProjectNameFromRecord(MicroAppEntity $record): string
    {
        $project = $this->projectRepository->findById($record->getProjectId());
        if ($project === null || $project->getDeletedAt() !== null) {
            return '';
        }

        return trim($project->getProjectName());
    }

    /** Resolve the install icon link from the generated file in the project root. */
    public function getInstallIconUrl(MicroAppEntity $record): string
    {
        $rootDirectory = $this->taskFileRepository->findRootDirectoryByProjectId($record->getProjectId());
        if ($rootDirectory === null) {
            return '';
        }

        $iconFile = $this->taskFileRepository->getByProjectParentAndName(
            $record->getProjectId(),
            $rootDirectory->getFileId(),
            self::INSTALL_ICON_FILE
        );
        if ($iconFile === null || $iconFile->getFileKey() === '') {
            return '';
        }

        try {
            $links = $this->fileDomainService->getLinks(
                $record->getOrganizationCode(),
                [$iconFile->getFileKey()],
                StorageBucketType::SandBox
            );
        } catch (Throwable) {
            return '';
        }

        $link = $links[$iconFile->getFileKey()] ?? null;
        return $link?->getUrl() ?? '';
    }
}
