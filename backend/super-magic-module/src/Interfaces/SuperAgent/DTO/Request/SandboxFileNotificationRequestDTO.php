<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\SandboxFileNotificationDataValueObject;

/**
 * Sandbox file notification request DTO.
 */
class SandboxFileNotificationRequestDTO extends AbstractRequestDTO
{
    /**
     * Metadata array.
     */
    public array $metadata = [];

    /**
     * Data array.
     */
    public array $data = [];

    /**
     * Get metadata array.
     */
    public function getMetadata(): array
    {
        return $this->metadata;
    }

    /**
     * Get data array.
     */
    public function getData(): array
    {
        return $this->data;
    }

    /**
     * Convert metadata array to MessageMetadata value object.
     */
    public function getMetadataValueObject(): MessageMetadata
    {
        return MessageMetadata::fromArray($this->metadata);
    }

    /**
     * Convert data array to SandboxFileNotificationDataValueObject.
     */
    public function getDataValueObject(): SandboxFileNotificationDataValueObject
    {
        return SandboxFileNotificationDataValueObject::fromArray($this->data);
    }

    /**
     * Get validation rules.
     */
    protected static function getHyperfValidationRules(): array
    {
        return [
            'metadata' => 'required|array',
            'metadata.super_magic_task_id' => 'required|string',
            'metadata.user_id' => 'required|string',
            'metadata.organization_code' => 'required|string',
            'data' => 'required|array',
            'data.timestamp' => 'required|integer',
            'data.operation' => 'required|string|in:CREATE,UPDATE,DELETE',
            'data.file_path' => 'required|string',
            'data.file_size' => 'nullable|integer|min:0',
        ];
    }

    /**
     * Get custom error messages for validation failures.
     */
    protected static function getHyperfValidationMessage(): array
    {
        return [
            'metadata.required' => 'Metadata cannot be empty',
            'metadata.array' => 'Metadata must be an array',
            'metadata.super_magic_task_id.required' => 'Task ID in metadata cannot be empty',
            'metadata.super_magic_task_id.string' => 'Task ID must be a string',
            'metadata.user_id.required' => 'User ID in metadata cannot be empty',
            'metadata.user_id.string' => 'User ID must be a string',
            'metadata.organization_code.required' => 'Organization code in metadata cannot be empty',
            'metadata.organization_code.string' => 'Organization code must be a string',
            'data.required' => 'Data cannot be empty',
            'data.array' => 'Data must be an array',
            'data.timestamp.required' => 'Timestamp cannot be empty',
            'data.timestamp.integer' => 'Timestamp must be an integer',
            'data.operation.required' => 'Operation cannot be empty',
            'data.operation.string' => 'Operation must be a string',
            'data.operation.in' => 'Operation must be one of: CREATE, UPDATE, DELETE',
            'data.file_path.required' => 'File path cannot be empty',
            'data.file_path.string' => 'File path must be a string',
            'data.file_size.integer' => 'File size must be an integer',
            'data.file_size.min' => 'File size cannot be negative',
        ];
    }
}
