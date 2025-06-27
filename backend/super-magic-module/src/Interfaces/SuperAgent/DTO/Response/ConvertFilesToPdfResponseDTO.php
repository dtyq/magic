<?php

declare(strict_types=1);

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use Dtyq\ApiResponse\Response\AbstractResponse;

class ConvertFilesToPdfResponseDTO extends AbstractResponse
{
    public bool $success;
    public array $files;
    public string $sandbox_id;
    public string $message;

    public function __construct(bool $success, array $files, string $sandboxId, string $message)
    {
        $this->success = $success;
        $this->files = $files;
        $this->sandbox_id = $sandboxId;
        $this->message = $message;
    }

    public static function fromArray(array $data): self
    {
        return new self(
            $data['success'] ?? false,
            $data['files'] ?? [],
            $data['sandbox_id'] ?? '',
            $data['message'] ?? 'An unknown error occurred.'
        );
    }

    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'files' => $this->files,
            'sandbox_id' => $this->sandbox_id,
            'message' => $this->message,
        ];
    }

    public function body(): array
    {
        return $this->toArray();
    }
} 