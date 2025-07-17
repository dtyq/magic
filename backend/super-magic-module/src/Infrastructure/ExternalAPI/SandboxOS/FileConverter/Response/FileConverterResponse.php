<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Response;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Contract\ResponseInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;

/**
 * 文件转换响应.
 */
class FileConverterResponse implements ResponseInterface
{
    private bool $success;

    private int $code;

    private string $message;

    private array $data;

    public function __construct(bool $success, int $code, string $message, array $data = [])
    {
        $this->success = $success;
        $this->code = $code;
        $this->message = $message;
        $this->data = $data;
    }

    public static function fromGatewayResult(GatewayResult $result): self
    {
        return new self(
            $result->isSuccess(),
            $result->getCode(),
            $result->getMessage(),
            $result->getData()
        );
    }

    public static function fromApiResponse(array $response): self
    {
        return new self(
            ($response['code'] ?? -1) === 1000,
            $response['code'] ?? -1,
            $response['message'] ?? 'Unknown error',
            $response['data'] ?? []
        );
    }

    public function isSuccess(): bool
    {
        return $this->success;
    }

    public function getCode(): int
    {
        return $this->code;
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    public function getData(): array
    {
        return $this->data;
    }

    public function getBatchId(): ?string
    {
        return $this->data['batch_id'] ?? null;
    }

    public function getConvertedFiles(): array
    {
        return $this->data['files'] ?? [];
    }

    public function getDownloadUrls(): array
    {
        return array_map(
            fn ($file) => $file['oss_download_url'] ?? null,
            $this->getConvertedFiles()
        );
    }

    public function getOssKeys(): array
    {
        return array_map(
            fn ($file) => $file['oss_key'] ?? null,
            $this->getConvertedFiles()
        );
    }

    /**
     * 获取总文件数.
     */
    public function getTotalFiles(): int
    {
        return $this->data['total_files'] ?? 0;
    }

    /**
     * 获取成功转换的文件数.
     */
    public function getSuccessCount(): int
    {
        return $this->data['success_count'] ?? 0;
    }

    /**
     * 获取ZIP文件下载地址.
     */
    public function getZipDownloadUrl(): ?string
    {
        $files = $this->getConvertedFiles();

        foreach ($files as $file) {
            if (($file['type'] ?? null) === 'zip') {
                return $file['oss_download_url'] ?? null;
            }
        }

        return null;
    }

    /**
     * 获取转换率.
     */
    public function getConversionRate(): ?float
    {
        $rate = $this->data['conversion_rate'] ?? null;
        return $rate !== null ? (float) $rate : null;
    }
}
