<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;

/**
 * 项目成员已更新事件.
 */
class ProjectMembersUpdatedEvent extends AbstractEvent
{
    /**
     * @param array $currentMembers 当前成员列表
     */
    public function __construct(
        private readonly ProjectEntity $projectEntity,
        private readonly array $currentMembers,
        private readonly MagicUserAuthorization $userAuthorization
    ) {
        parent::__construct();
    }

    public function getProjectEntity(): ProjectEntity
    {
        return $this->projectEntity;
    }

    public function getCurrentMembers(): array
    {
        return $this->currentMembers;
    }

    public function getUserAuthorization(): MagicUserAuthorization
    {
        return $this->userAuthorization;
    }
}
