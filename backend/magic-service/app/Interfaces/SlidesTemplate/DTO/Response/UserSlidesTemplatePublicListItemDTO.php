<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Response;

class UserSlidesTemplatePublicListItemDTO extends SlidesTemplatePublicListItemDTO
{
    public ?SlidesTemplateProjectDTO $project = null;

    public function setProject(null|int|string $projectId, null|int|string $directoryId): void
    {
        $this->project = $projectId === null || $projectId === ''
            ? null
            : new SlidesTemplateProjectDTO($projectId, $directoryId);
    }
}
