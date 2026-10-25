<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\DTO\Request;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\ShadowCode\ShadowCode;
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

    /**
     * 保存前期望匹配的文件元数据修订号。
     */
    private ?int $expectedRevision = null;

    public function __construct(
        string $fileId = '',
        string $content = '',
        bool $enableShadow = true,
        ?int $expectedRevision = null
    ) {
        $this->fileId = $fileId;
        $this->content = $content;
        $this->enableShadow = $enableShadow;
        $this->expectedRevision = $expectedRevision;
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
        $expectedRevision = self::parseExpectedRevision($requestData);

        $dto = new self($fileId, $content, $enableShadow, $expectedRevision);
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

        // V2 的 Base64 开销不应挤占原有 10 MiB 正文容量，先限制编码体积再解码校验。
        $contentSize = strlen($this->content);
        if ($this->enableShadow && str_starts_with($this->content, ShadowCode::PREFIX_V2)) {
            $maxEncodedSize = strlen(ShadowCode::PREFIX_V2) + 4 * intdiv(self::MAX_CONTENT_SIZE + 2, 3);
            if ($contentSize > $maxEncodedSize) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'content_too_large');
            }
            $contentSize = strlen(ShadowCode::unShadow($this->content));
        }
        if ($contentSize > self::MAX_CONTENT_SIZE) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'content_too_large');
        }

        if ($this->expectedRevision !== null && $this->expectedRevision <= 0) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'expected_revision_invalid');
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

    /**
     * 获取保存前期望匹配的文件元数据修订号。
     */
    public function getExpectedRevision(): ?int
    {
        return $this->expectedRevision;
    }

    /**
     * 设置保存前期望匹配的文件元数据修订号。
     */
    public function setExpectedRevision(?int $expectedRevision): void
    {
        $this->expectedRevision = $expectedRevision;
    }

    public function jsonSerialize(): array
    {
        $data = [
            'file_id' => $this->fileId,
            'content' => $this->content,
            'enable_shadow' => $this->enableShadow,
        ];

        if ($this->expectedRevision !== null) {
            $data['expected_revision'] = $this->expectedRevision;
        }

        return $data;
    }

    /**
     * 从请求中解析可选的修订号，并拒绝非正整数字段。
     */
    private static function parseExpectedRevision(array $requestData): ?int
    {
        if (! array_key_exists('expected_revision', $requestData) || $requestData['expected_revision'] === null) {
            return null;
        }

        $value = $requestData['expected_revision'];
        if (! is_int($value) && (! is_string($value) || preg_match('/^[1-9][0-9]*$/', $value) !== 1)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'expected_revision_invalid');
        }

        return (int) $value;
    }
}
