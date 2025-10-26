<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\DTO;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;

/**
 * ASR 沙箱合并结果 DTO.
 */
readonly class AsrSandboxMergeResultDTO
{
    public function __construct(
        public TaskStatus $status,
        public string $filePath,
        public ?int $duration = null,
        public ?int $fileSize = null,
        public ?string $errorMessage = null
    ) {
    }

    /**
     * 从沙箱 API 响应创建 DTO.
     */
    public static function fromSandboxResponse(array $response): self
    {
        return new self(
            status: TaskStatus::from($response['status'] ?? 'error'),
            filePath: $response['file_path'] ?? '',
            duration: $response['duration'] ?? null,
            fileSize: $response['file_size'] ?? null,
            errorMessage: $response['error_message'] ?? null
        );
    }

    /**
     * 检查合并是否完成.
     */
    public function isFinished(): bool
    {
        return $this->status === TaskStatus::FINISHED;
    }

    /**
     * 检查合并是否失败.
     */
    public function isError(): bool
    {
        return $this->status === TaskStatus::ERROR;
    }

    /**
     * 转换为数组（用于兼容现有代码）.
     */
    public function toArray(): array
    {
        return [
            'status' => $this->status,
            'file_path' => $this->filePath,
            'duration' => $this->duration,
            'file_size' => $this->fileSize,
            'error_message' => $this->errorMessage,
        ];
    }
}
