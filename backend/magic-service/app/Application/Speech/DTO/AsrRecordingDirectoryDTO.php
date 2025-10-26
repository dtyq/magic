<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\DTO;

/**
 * 录音目录信息 DTO.
 */
readonly class AsrRecordingDirectoryDTO
{
    public function __construct(
        public string $directoryPath,
        public int $directoryId,
        public bool $hidden
    ) {
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'directory_path' => $this->directoryPath,
            'directory_id' => $this->directoryId,
            'hidden' => $this->hidden,
        ];
    }
}
