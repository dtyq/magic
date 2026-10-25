<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Response;

class UserSlidesTemplatePublicDetailDTO extends SlidesTemplatePublicDetailDTO
{
    public SlidesTemplateProjectDTO $project;

    public function setProject(int|string $projectId, null|int|string $directoryId): void
    {
        $this->project = new SlidesTemplateProjectDTO($projectId, $directoryId);
    }
}
