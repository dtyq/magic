<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use JsonSerializable;

/**
 * Save File Content Request DTO.
 */
class SaveFileContentRequestDTO implements JsonSerializable
{
    /**
     * Maximum content size (10MB).
     */
    private const int MAX_CONTENT_SIZE = 10 * 1024 * 1024;

    /**
     * File ID.
     */
    private int $fileId = 0;

    /**
     * File content (HTML).
     */
    private string $content = '';

    /**
     * Whether to enable shadow decoding for content.
     */
    private bool $enableShadow = true;

    public function __construct(int $fileId = 0, string $content = '', bool $enableShadow = true)
    {
        $this->fileId = $fileId;
        $this->content = $content;
        $this->enableShadow = $enableShadow;
    }

    /**
     * Create DTO from request data.
     */
    public static function fromRequest(array $requestData): self
    {
        $fileId = (int) ($requestData['file_id'] ?? 0);
        $content = (string) ($requestData['content'] ?? '');
        $enableShadow = (bool) ($requestData['enable_shadow'] ?? true);

        $dto = new self($fileId, $content, $enableShadow);
        $dto->validate();

        return $dto;
    }

    /**
     * Validate request parameters.
     */
    public function validate(): void
    {
        if ($this->fileId <= 0) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'file_id_required');
        }

        if (empty($this->content)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'content_required');
        }

        $contentSize = strlen($this->content);
        if ($contentSize > self::MAX_CONTENT_SIZE) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'content_too_large');
        }
    }

    public function getFileId(): int
    {
        return $this->fileId;
    }

    public function setFileId(int $fileId): void
    {
        $this->fileId = $fileId;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function setContent(string $content): void
    {
        $this->content = $content;
    }

    public function getEnableShadow(): bool
    {
        return $this->enableShadow;
    }

    public function setEnableShadow(bool $enableShadow): void
    {
        $this->enableShadow = $enableShadow;
    }

    public function jsonSerialize(): array
    {
        return [
            'file_id' => $this->fileId,
            'content' => $this->content,
            'enable_shadow' => $this->enableShadow,
        ];
    }
}
