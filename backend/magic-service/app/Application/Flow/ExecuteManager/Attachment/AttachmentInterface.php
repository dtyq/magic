<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Attachment;

interface AttachmentInterface
{
    public function getFileId(): string;

    public function getUrl(): string;

    public function getName(): string;

    public function getExt(): string;

    public function getSize(): int;

    public function isImage(): bool;

    public function toArray(): array;
}
