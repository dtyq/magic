<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\KnowledgeBase\DTO\DocumentFile;

use App\Domain\KnowledgeBase\Entity\ValueObject\DocumentFile\DocumentFileType;

interface DocumentFileDTOInterface
{
    public function getName(): string;

    public function getType(): DocumentFileType;
}
