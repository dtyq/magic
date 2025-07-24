<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Response;

/**
 * 文件转换响应中的数据对象.
 */
class ConverterDataDTO
{
    public string $taskKey = '';

    public string $status = '';

    public string $convertType = '';

    public string $createdAt = '';

    public string $updatedAt = '';

    public string $batchId = '';

    public int $totalFiles = 0;

    public int $successCount = 0;

    public int $validFilesCount = 0;

    public int $skippedFilesCount = 0;

    public float $conversionRate = 0.0;

    public ?int $progress = null;

    /**
     * @var FileItemDTO[]
     */
    public array $files = [];

    public ?string $errorMessage = null;

    public static function fromArray(array $data): self
    {
        $dto = new self();
        $dto->taskKey = $data['task_key'] ?? '';
        $dto->status = $data['status'] ?? '';
        $dto->convertType = $data['convert_type'] ?? '';
        $dto->createdAt = $data['created_at'] ?? '';
        $dto->updatedAt = $data['updated_at'] ?? '';
        $dto->batchId = $data['batch_id'] ?? '';
        $dto->totalFiles = $data['total_files'] ?? 0;
        $dto->successCount = $data['success_count'] ?? 0;
        $dto->validFilesCount = $data['valid_files_count'] ?? 0;
        $dto->skippedFilesCount = $data['skipped_files_count'] ?? 0;
        $dto->conversionRate = (float) ($data['conversion_rate'] ?? 0.0);
        $dto->progress = isset($data['progress']) ? (int) $data['progress'] : null;
        $dto->errorMessage = $data['error_message'] ?? null;

        if (! empty($data['files']) && is_array($data['files'])) {
            foreach ($data['files'] as $fileData) {
                $dto->files[] = FileItemDTO::fromArray($fileData);
            }
        }

        return $dto;
    }

    public function toArray(): array
    {
        return [
            'task_key' => $this->taskKey,
            'status' => $this->status,
            'convert_type' => $this->convertType,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'batch_id' => $this->batchId,
            'total_files' => $this->totalFiles,
            'success_count' => $this->successCount,
            'valid_files_count' => $this->validFilesCount,
            'skipped_files_count' => $this->skippedFilesCount,
            'conversion_rate' => $this->conversionRate,
            'progress' => $this->progress,
            'files' => array_map(fn (FileItemDTO $file) => $file->toArray(), $this->files),
            'error_message' => $this->errorMessage,
        ];
    }
}
