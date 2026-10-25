<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Response;

class UsedSlidesTemplatePublicListItemDTO extends SlidesTemplatePublicListItemDTO
{
    public ?string $latestUsedAt = null;

    public function setLatestUsedAt(?string $latestUsedAt): void
    {
        $this->latestUsedAt = $latestUsedAt;
    }
}
