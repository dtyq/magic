<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Facade;

use App\Domain\Chat\Entity\MagicMessageVersionEntity;

interface MagicChatMessageVersionsRepositoryInterface
{
    public function createMessageVersion(MagicMessageVersionEntity $messageVersionDTO): MagicMessageVersionEntity;

    /**
     * @return MagicMessageVersionEntity[]
     */
    public function getMessageVersions(string $magicMessageId): array;
}
