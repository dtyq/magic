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
    private int $code;

    private string $message;

    private array $data;

    public function __construct(int $code, string $message, array $data)
    {
        $this->code = $code;
        $this->message = $message;
        $this->data = $data;
    }

    /**
     * 从沙箱网关结果创建响应.
     * @param mixed $result
     */
    public static function fromGatewayResult($result): self
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
     * 获取文件路径.
     */
    public function getFilePath(): ?string
    {
        $path = $this->data['file_path'] ?? null;
        return $path !== '' ? $path : null;
    }

    /**
     * 获取音频时长（秒）.
     */
    public function getDuration(): ?int
    {
        return $this->data['duration'] ?? null;
    }

    /**
     * 获取文件大小（字节）.
     */
    public function getFileSize(): ?int
    {
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
     * 获取响应码.
     */
    public function getCode(): int
    {
        return $this->code;
    }

    /**
     * 获取响应消息.
     */
    public function getMessage(): string
    {
        return $this->message;
    }

    /**
     * 获取响应数据.
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
