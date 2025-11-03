<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Response;

/**
 * ASR 录音服务响应.
 */
class AsrRecorderResponse
{
    public int $code {
        get {
            return $this->code;
        }
    }

    public string $message {
        get {
            return $this->message;
        }
    }

    private array $data {
        get {
            return $this->data;
        }
    }

    public function __construct(int $code, string $message, array $data)
    {
        $this->code = $code;
        $this->message = $message;
        $this->data = $data;
    }

    /**
     * 从沙箱网关结果创建响应.
     */
    public static function fromGatewayResult(mixed $result): self
    {
        if (! $result->isSuccess()) {
            return new self(
                $result->getCode(),
                $result->getMessage(),
                []
            );
        }

        $data = $result->getData();
        return new self(
            $result->getCode(),
            $result->getMessage(),
            $data
        );
    }

    /**
     * 从 API 响应创建.
     */
    public static function fromApiResponse(array $response): self
    {
        return new self(
            $response['code'] ?? -1,
            $response['message'] ?? '',
            $response['data'] ?? []
        );
    }

    /**
     * 是否成功（code = 1000）.
     */
    public function isSuccess(): bool
    {
        return $this->code === 1000;
    }

    /**
     * 获取任务状态.
     */
    public function getStatus(): string
    {
        return $this->data['status'] ?? 'error';
    }

    /**
     * 获取文件路径 (兼容 V2 和旧格式).
     */
    public function getFilePath(): ?string
    {
        // V2 格式：从 files.audio_file.path 读取
        if (isset($this->data['files']['audio_file']['path'])) {
            return $this->data['files']['audio_file']['path'];
        }

        // 旧格式：从 file_path 读取（向后兼容）
        $path = $this->data['file_path'] ?? null;
        return $path !== '' ? $path : null;
    }

    /**
     * 获取音频时长（秒） (兼容 V2 和旧格式).
     */
    public function getDuration(): ?int
    {
        // V2 格式：从 files.audio_file.duration 读取
        if (isset($this->data['files']['audio_file']['duration'])) {
            return (int) $this->data['files']['audio_file']['duration'];
        }

        // 旧格式：从 duration 读取（向后兼容）
        return $this->data['duration'] ?? null;
    }

    /**
     * 获取文件大小（字节） (兼容 V2 和旧格式).
     */
    public function getFileSize(): ?int
    {
        // V2 格式：从 files.audio_file.size 读取
        if (isset($this->data['files']['audio_file']['size'])) {
            return (int) $this->data['files']['audio_file']['size'];
        }

        // 旧格式：从 file_size 读取（向后兼容）
        return $this->data['file_size'] ?? null;
    }

    /**
     * 获取错误信息.
     */
    public function getErrorMessage(): ?string
    {
        return $this->data['error_message'] ?? null;
    }

    /**
     * 获取完整的 data 数组（用于响应处理）.
     */
    public function getData(): array
    {
        return $this->data;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'code' => $this->code,
            'message' => $this->message,
            'data' => $this->data,
        ];
    }
}
