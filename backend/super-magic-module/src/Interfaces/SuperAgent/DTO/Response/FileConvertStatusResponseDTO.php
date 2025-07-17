<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * 文件转换状态响应DTO.
 */
class FileConvertStatusResponseDTO
{
    /**
     * 转换状态
     */
    protected string $status;

    /**
     * 下载链接.
     */
    protected ?string $downloadUrl;

    /**
     * 进度百分比.
     */
    protected ?int $progress;

    /**
     * 状态消息.
     */
    protected string $message;

    /**
     * 总文件数.
     */
    protected ?int $totalFiles;

    /**
     * 成功转换数.
     */
    protected ?int $successCount;

    /**
     * 转换类型.
     */
    protected ?string $convertType;

    /**
     * 批次ID.
     */
    protected ?string $batchId;

    /**
     * 任务键.
     */
    protected ?string $taskKey;

    /**
     * 转换成功率.
     */
    protected ?float $conversionRate;

    /**
     * 构造函数.
     */
    public function __construct(
        string $status,
        ?string $downloadUrl = null,
        ?int $progress = null,
        string $message = '',
        ?int $totalFiles = null,
        ?int $successCount = null,
        ?string $convertType = null,
        ?string $batchId = null,
        ?string $taskKey = null,
        ?float $conversionRate = null
    ) {
        $this->status = $status;
        $this->downloadUrl = $downloadUrl;
        $this->progress = $progress;
        $this->message = $message;
        $this->totalFiles = $totalFiles;
        $this->successCount = $successCount;
        $this->convertType = $convertType;
        $this->batchId = $batchId;
        $this->taskKey = $taskKey;
        $this->conversionRate = $conversionRate;
    }

    /**
     * 从数组创建DTO.
     */
    public static function fromArray(array $data): self
    {
        return new self(
            $data['status'] ?? '',
            $data['download_url'] ?? null,
            $data['progress'] ?? null,
            $data['message'] ?? '',
            $data['total_files'] ?? null,
            $data['success_count'] ?? null,
            $data['convert_type'] ?? null,
            $data['batch_id'] ?? null,
            $data['task_key'] ?? null,
            $data['conversion_rate'] ?? null
        );
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'status' => $this->status,
            'download_url' => $this->downloadUrl,
            'progress' => $this->progress,
            'message' => $this->message,
            'total_files' => $this->totalFiles,
            'success_count' => $this->successCount,
            'convert_type' => $this->convertType,
            'batch_id' => $this->batchId,
            'task_key' => $this->taskKey,
            'conversion_rate' => $this->conversionRate,
        ];
    }

    /**
     * 获取转换状态
     */
    public function getStatus(): string
    {
        return $this->status;
    }

    /**
     * 设置转换状态
     */
    public function setStatus(string $status): self
    {
        $this->status = $status;
        return $this;
    }

    /**
     * 获取下载链接.
     */
    public function getDownloadUrl(): ?string
    {
        return $this->downloadUrl;
    }

    /**
     * 设置下载链接.
     */
    public function setDownloadUrl(?string $downloadUrl): self
    {
        $this->downloadUrl = $downloadUrl;
        return $this;
    }

    /**
     * 获取进度百分比.
     */
    public function getProgress(): ?int
    {
        return $this->progress;
    }

    /**
     * 设置进度百分比.
     */
    public function setProgress(?int $progress): self
    {
        $this->progress = $progress;
        return $this;
    }

    /**
     * 获取状态消息.
     */
    public function getMessage(): string
    {
        return $this->message;
    }

    /**
     * 设置状态消息.
     */
    public function setMessage(string $message): self
    {
        $this->message = $message;
        return $this;
    }

    /**
     * 获取总文件数.
     */
    public function getTotalFiles(): ?int
    {
        return $this->totalFiles;
    }

    /**
     * 设置总文件数.
     */
    public function setTotalFiles(?int $totalFiles): self
    {
        $this->totalFiles = $totalFiles;
        return $this;
    }

    /**
     * 获取成功转换数.
     */
    public function getSuccessCount(): ?int
    {
        return $this->successCount;
    }

    /**
     * 设置成功转换数.
     */
    public function setSuccessCount(?int $successCount): self
    {
        $this->successCount = $successCount;
        return $this;
    }

    /**
     * 获取转换类型.
     */
    public function getConvertType(): ?string
    {
        return $this->convertType;
    }

    /**
     * 设置转换类型.
     */
    public function setConvertType(?string $convertType): self
    {
        $this->convertType = $convertType;
        return $this;
    }

    /**
     * 获取批次ID.
     */
    public function getBatchId(): ?string
    {
        return $this->batchId;
    }

    /**
     * 设置批次ID.
     */
    public function setBatchId(?string $batchId): self
    {
        $this->batchId = $batchId;
        return $this;
    }

    /**
     * 获取任务键.
     */
    public function getTaskKey(): ?string
    {
        return $this->taskKey;
    }

    /**
     * 设置任务键.
     */
    public function setTaskKey(?string $taskKey): self
    {
        $this->taskKey = $taskKey;
        return $this;
    }

    /**
     * 获取转换成功率.
     */
    public function getConversionRate(): ?float
    {
        return $this->conversionRate;
    }

    /**
     * 设置转换成功率.
     */
    public function setConversionRate(?float $conversionRate): self
    {
        $this->conversionRate = $conversionRate;
        return $this;
    }
}
