<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Common\RecycleBin\DTO;

use App\Domain\SuperMagic\Common\RecycleBin\Entity\RecycleBinEntity;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;

class RecycleBinFilePreviewResponseDTO
{
    public function __construct(
        private readonly RecycleBinEntity $record,
        private readonly TaskFileEntity $file,
        private readonly string $url,
    ) {
    }

    public function toArray(): array
    {
        return [
            'recycle_bin_id' => (string) $this->record->getId(),
            'file_id' => (string) $this->file->getFileId(),
            'file_name' => $this->file->getFileName(),
            'file_extension' => $this->file->getFileExtension(),
            'file_size' => $this->file->getFileSize(),
            'is_directory' => false,
            'space_type' => $this->file->getSpaceType(),
            'project_id' => (string) $this->file->getProjectId(),
            'relative_file_path' => $this->record->getExtraData()['relative_file_path'] ?? '',
            'updated_at' => $this->file->getUpdatedAt(),
            'url' => $this->url,
            'expires_at' => gmdate('Y-m-d H:i:s', time() + TaskFileDomainService::URL_EXPIRES) . ' UTC',
        ];
    }
}
