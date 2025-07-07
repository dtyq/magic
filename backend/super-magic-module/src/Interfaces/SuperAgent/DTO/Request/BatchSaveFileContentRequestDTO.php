<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Application\SuperAgent\Config\BatchProcessConfig;
use JsonSerializable;

/**
 * Batch Save File Content Request DTO.
 */
class BatchSaveFileContentRequestDTO implements JsonSerializable
{
    /**
     * Array of SaveFileContentRequestDTO objects.
     *
     * @var SaveFileContentRequestDTO[]
     */
    private array $files = [];

    /**
     * Original count before deduplication.
     */
    private int $originalCount = 0;

    /**
     * @param SaveFileContentRequestDTO[] $files
     */
    public function __construct(array $files = [])
    {
        $this->files = $files;
    }

    /**
     * Create DTO from request data.
     */
    public static function fromRequest(array $requestData): self
    {
        if (empty($requestData)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'files_array_required');
        }

        $files = [];
        $fileMap = []; // 用于去重的映射表

        foreach ($requestData as $fileData) {
            if (! is_array($fileData)) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'invalid_file_data_format');
            }

            $fileDTO = SaveFileContentRequestDTO::fromRequest($fileData);
            $fileId = $fileDTO->getFileId();

            // 如果file_id重复，用后面的覆盖前面的（保留最后一个）
            $fileMap[$fileId] = $fileDTO;
        }

        // 转换为数组（去重后的文件列表）
        $files = array_values($fileMap);

        $dto = new self($files);
        $dto->originalCount = count($requestData); // 记录原始数量
        $dto->validate();

        return $dto;
    }

    /**
     * Validate request parameters.
     */
    public function validate(): void
    {
        if (empty($this->files)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'files_array_required');
        }

        $maxBatchSize = BatchProcessConfig::getBatchSizeLimit();
        if (count($this->files) > $maxBatchSize) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'batch_size_exceeded');
        }

        // Validate each file
        foreach ($this->files as $file) {
            $file->validate();
        }

        // 注意：重复的file_id已在fromRequest方法中自动去重，这里不再检查
    }

    /**
     * @return SaveFileContentRequestDTO[]
     */
    public function getFiles(): array
    {
        return $this->files;
    }

    /**
     * @param SaveFileContentRequestDTO[] $files
     */
    public function setFiles(array $files): void
    {
        $this->files = $files;
    }

    public function getFileCount(): int
    {
        return count($this->files);
    }

    public function getOriginalCount(): int
    {
        return $this->originalCount;
    }

    public function getDeduplicatedCount(): int
    {
        return $this->originalCount - count($this->files);
    }

    public function jsonSerialize(): array
    {
        return array_map(fn ($file) => $file->jsonSerialize(), $this->files);
    }
}
