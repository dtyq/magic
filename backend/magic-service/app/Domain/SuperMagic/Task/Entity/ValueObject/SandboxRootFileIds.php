<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Entity\ValueObject;

final readonly class SandboxRootFileIds
{
    public function __construct(
        private string $projectSpaceRootFileId = '',
        private string $userSpaceRootFileId = '',
        private string $topicSpaceRootFileId = '',
    ) {
    }

    public function getProjectSpaceRootFileId(): string
    {
        return $this->projectSpaceRootFileId;
    }

    public function getUserSpaceRootFileId(): string
    {
        return $this->userSpaceRootFileId;
    }

    public function getTopicSpaceRootFileId(): string
    {
        return $this->topicSpaceRootFileId;
    }
}
