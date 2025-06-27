<?php

declare(strict_types=1);

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use Dtyq\ApiResponse\Response\AbstractResponse;

class ConvertFilesToPdfResponseDTO extends AbstractResponse
{
    public bool $success;
    public array $download_urls;
    public array $failed_files;
    public ?string $batch_id;

    public function __construct(bool $success, array $downloadUrls, array $failedFiles, ?string $batchId)
    {
        $this->success = $success;
        $this->download_urls = $downloadUrls;
        $this->failed_files = $failedFiles;
        $this->batch_id = $batchId;
    }

    public static function fromArray(array $data): self
    {
        return new self(
            $data['success'] ?? false,
            $data['download_urls'] ?? [],
            $data['failed_files'] ?? [],
            $data['batch_id'] ?? null
        );
    }

    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'download_urls' => $this->download_urls,
            'failed_files' => $this->failed_files,
            'batch_id' => $this->batch_id,
        ];
    }

    public function body(): array
    {
        return $this->toArray();
    }
} 