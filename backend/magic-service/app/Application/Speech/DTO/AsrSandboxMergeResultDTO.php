<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\DTO;

use App\Application\Speech\Enum\SandboxAsrStatusEnum;

/**
 * ASR 沙箱合并结果 DTO.
 */
readonly class AsrSandboxMergeResultDTO
{
    public function __construct(
        public SandboxAsrStatusEnum $status,
        public string $filePath,
        public ?int $duration = null,
        public ?int $fileSize = null,
        public ?string $errorMessage = null,
        public ?string $audioFormat = null,
        public array $responseData = [],
    ) {
    }

    /**
     * 从沙箱 API 响应创建 DTO.
     */
    public static function fromSandboxResponse(array $response): self
    {
        $statusValue = $response['status'] ?? 'error';
        $status = SandboxAsrStatusEnum::fromString($statusValue) ?? SandboxAsrStatusEnum::ERROR;

        return new self(
            status: $status,
            filePath: $response['file_path'] ?? '',
            duration: $response['duration'] ?? null,
            fileSize: $response['file_size'] ?? null,
            errorMessage: $response['error_message'] ?? null,
            audioFormat: self::resolveAudioFormat($response),
            responseData: is_array($response['response_data'] ?? null) ? $response['response_data'] : [],
        );
    }

    /**
     * 检查合并是否完成.
     */
    public function isFinished(): bool
    {
        return $this->status->isCompleted();
    }

    /**
     * 检查合并是否失败.
     */
    public function isError(): bool
    {
        return $this->status->isError();
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
            'audio_format' => $this->audioFormat,
            'response_data' => $this->responseData,
        ];
    }

    private static function resolveAudioFormat(array $response): ?string
    {
        $responseData = is_array($response['response_data'] ?? null) ? $response['response_data'] : [];
        $files = is_array($responseData['files'] ?? null) ? $responseData['files'] : [];
        $audioFile = is_array($files['audio_file'] ?? null) ? $files['audio_file'] : [];
        $format = $response['audio_format']
            ?? $responseData['audio_format']
            ?? $audioFile['audio_format']
            ?? $audioFile['format']
            ?? null;
        if (! is_string($format) || trim($format) === '') {
            $format = is_string($response['file_path'] ?? null)
                ? pathinfo($response['file_path'], PATHINFO_EXTENSION)
                : null;
        }
        if (! is_string($format)) {
            return null;
        }
        $format = strtolower(ltrim(trim($format), '.'));
        return in_array($format, ['wav', 'opus'], true) ? $format : null;
    }
}
