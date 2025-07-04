<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\File;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionDataInterface;
use App\Infrastructure\Core\AbstractDTO;

final class ProjectFileData extends AbstractDTO implements MentionDataInterface
{
    protected string $fileId;

    protected string $fileKey;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    /* Getters */
    public function getFileId(): ?string
    {
        return $this->fileId ?? null;
    }

    public function getFileKey(): ?string
    {
        return $this->fileKey ?? null;
    }

    /* Setters */
    public function setFileId(string $fileId): void
    {
        $this->fileId = $fileId;
    }

    public function setFileKey(string $fileKey): void
    {
        $this->fileKey = $fileKey;
    }
}
