<?php

declare(strict_types=1);

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\PdfConverter\Response;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Contract\ResponseInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;

/**
 * PDF 转换响应
 */
class PdfConverterResponse implements ResponseInterface
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

    public function getConvertedFileId(): ?string
    {
        return $this->data['file_id'] ?? null;
    }

    public function getConvertedFiles(): array
    {
        return $this->data['results'] ?? [];
    }
} 