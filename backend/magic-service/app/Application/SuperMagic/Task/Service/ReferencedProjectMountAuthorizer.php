<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Service;

use App\Application\SuperMagic\Project\Service\PublishedMicroAppFileAccessService;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppResolver;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Common\Share\Constant\ShareAccessType;
use App\ErrorCode\ShareErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

/**
 * Authorize published-share mounts without requiring project collaboration.
 */
class ReferencedProjectMountAuthorizer
{
    public function __construct(
        private readonly PublishedMicroAppResolver $publishedMicroAppResolver,
        private readonly PublishedMicroAppFileAccessService $publishedFileAccess,
    ) {
    }

    public function assertPublishedShareAccessible(
        ReferencedProjectMount $mount,
        DataIsolation $dataIsolation,
    ): void {
        $appId = (int) ($mount->appId ?? '');
        if ($appId <= 0) {
            ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED);
        }

        $publishedMicroApp = $this->publishedMicroAppResolver->findPublished($appId);
        if ($publishedMicroApp === null) {
            ExceptionBuilder::throw(ShareErrorCode::NOT_FOUND);
        }

        [$record, $shareEntity] = $publishedMicroApp;
        if ((string) $record->getProjectId() !== $mount->projectId) {
            ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED);
        }

        if ($shareEntity->getShareType() === ShareAccessType::PasswordProtected->value) {
            ExceptionBuilder::throw(ShareErrorCode::PASSWORD_REQUIRED);
        }

        $canAccess = $this->publishedFileAccess->canAccessProject(
            $record->getProjectId(),
            (string) $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
        );
        if (! $canAccess) {
            ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED);
        }
    }
}
