<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Service;

use App\Application\SuperMagic\Project\Service\MicroAppProjectAppService;
use Throwable;

/**
 * Collaboration-axis check for referenced project mounts.
 */
class ReferencedProjectCollaborationAccess
{
    public function __construct(
        private readonly MicroAppProjectAppService $microAppProjectAppService,
    ) {
    }

    public function canAccess(int $projectId, string $userId, string $organizationCode): bool
    {
        try {
            $this->microAppProjectAppService->getAccessibleProject($projectId, $userId, $organizationCode);
            return true;
        } catch (Throwable) {
            return false;
        }
    }

    public function canEdit(int $projectId, string $userId, string $organizationCode): bool
    {
        try {
            $this->microAppProjectAppService->getAccessibleProjectWithEditor($projectId, $userId, $organizationCode);
            return true;
        } catch (Throwable) {
            return false;
        }
    }
}
