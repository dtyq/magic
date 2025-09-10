<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;

/**
 * 项目快捷方式设置事件.
 */
class ProjectShortcutSetEvent extends AbstractEvent
{
    public function __construct(
        private readonly ProjectEntity $projectEntity,
        private readonly int $workspaceId,
        private readonly MagicUserAuthorization $userAuthorization
    ) {
        parent::__construct();
    }

    public function getProjectEntity(): ProjectEntity
    {
        return $this->projectEntity;
    }

    public function getWorkspaceId(): int
    {
        return $this->workspaceId;
    }

    public function getUserAuthorization(): MagicUserAuthorization
    {
        return $this->userAuthorization;
    }

    public function getProjectId(): int
    {
        return $this->projectEntity->getId();
    }

    public function getUserId(): string
    {
        return $this->userAuthorization->getId();
    }

    public function getOrganizationCode(): string
    {
        return $this->userAuthorization->getOrganizationCode();
    }
}
