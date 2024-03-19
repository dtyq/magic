<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\Items;

use App\Domain\Agent\Entity\AbstractEntity;

class ConversationExtra extends AbstractEntity
{
    // 默认话题Id
    protected string $defaultTopicId;

    public function __construct(?array $data = null)
    {
        parent::__construct($data);
    }

    public function getDefaultTopicId(): string
    {
        return $this->defaultTopicId;
    }

    public function setDefaultTopicId(string $defaultTopicId): void
    {
        $this->defaultTopicId = $defaultTopicId;
    }
}
