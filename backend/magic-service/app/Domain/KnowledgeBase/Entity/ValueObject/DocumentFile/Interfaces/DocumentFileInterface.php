<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\Interfaces;

interface DocumentFileInterface
{
    public function getDocType(): ?int;

    public function getName(): string;

    public function getPlatformType(): ?string;

    public function getThirdFileId(): ?string;

    public function toArray(): array;
}
