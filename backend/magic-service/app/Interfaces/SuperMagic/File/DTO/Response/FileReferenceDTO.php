<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\DTO\Response;

use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;

final readonly class FileReferenceDTO
{
    public function __construct(
        public string $fileId,
        public string $fileName,
        public bool $isDirectory,
        public string $fileExtension,
        public FileSpaceType $spaceType,
        public string $spaceRelativePath,
        public ?string $projectId = null,
    ) {
    }

    public function toArray(): array
    {
        $result = [
            'file_id' => $this->fileId,
            'file_name' => $this->fileName,
            'is_directory' => $this->isDirectory,
            'file_extension' => $this->fileExtension,
            'space_type' => $this->spaceType->value,
            'space_relative_path' => $this->spaceRelativePath,
        ];
        if ($this->spaceType === FileSpaceType::PROJECT) {
            $result['project_id'] = $this->projectId;
        }
        return $result;
    }
}
