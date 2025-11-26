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
    private string $fileId = '';

    /**
     * File content (HTML).
     */
    private string $content = '';

    /**
     * Whether to enable shadow decoding for content.
     */
    private bool $enableShadow = true;

    public function __construct(string $fileId = '', string $content = '', bool $enableShadow = true)
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
        $fileId = (string) ($requestData['file_id'] ?? '');

        // Check if content field exists in request (required field)
        if (! array_key_exists('content', $requestData)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'content_field_required');
        }

        // Allow empty string value
        $content = (string) $requestData['content'];
        $enableShadow = (bool) ($requestData['enable_shadow'] ?? false);

        $dto = new self($fileId, $content, $enableShadow);
        $dto->validate();

        return $dto;
    }

    /**
     * Validate request parameters.
     */
    public function validate(): void
    {
        if (empty($this->fileId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'file_id_required');
        }

        // Remove empty content check - allow empty string value
        // Content field existence is already checked in fromRequest()

        // Validate content size limit
        $contentSize = strlen($this->content);
        if ($contentSize > self::MAX_CONTENT_SIZE) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'content_too_large');
        }
    }

    public function getFileId(): string
    {
        return $this->fileId;
    }

    public function setFileId(string $fileId): void
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
