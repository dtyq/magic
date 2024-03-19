<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;

/**
 * Projects batch moved event.
 */
class ProjectsBatchMovedEvent extends AbstractEvent
{
    /**
     * @param ProjectEntity[] $projectEntities
     */
    public function __construct(
        private readonly array $projectEntities,
        private readonly MagicUserAuthorization $userAuthorization
    ) {
        parent::__construct();
    }

    /**
     * @return ProjectEntity[]
     */
    public function getProjectEntities(): array
    {
        return $this->projectEntities;
    }

    public function getUserAuthorization(): MagicUserAuthorization
    {
        return $this->userAuthorization;
    }
}
