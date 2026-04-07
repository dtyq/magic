<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\MagicFS\DTO\Request;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageMetadata;
use Dtyq\SuperMagic\ErrorCode\MagicFSErrorCode;
use Hyperf\HttpServer\Contract\RequestInterface;

class CreateFileRequestDTO
{
    public string $name = '';

    public string $parent_id = '';

    public bool $is_directory = false;

    public array $metadata = [];

    public static function fromRequest(RequestInterface $request): self
    {
        $data = $request->all();

        $dto = new self();
        $dto->name = trim($data['name'] ?? '');
        $dto->parent_id = $data['parent_id'] ?? '';
        $dto->is_directory = (bool) ($data['is_directory'] ?? false);
        $dto->metadata = $data['metadata'] ?? [];

        // 验证必填字段
        if (empty($dto->name)) {
            ExceptionBuilder::throw(
                MagicFSErrorCode::INVALID_FILE_NAME,
                'magicfs.name_is_required'
            );
        }

        return $dto;
    }

    /**
     * 获取 MessageMetadata 值对象.
     */
    public function getMetadataValueObject(): MessageMetadata
    {
        return MessageMetadata::fromArray($this->metadata);
    }

    /**
     * 获取 metadata 数组.
     */
    public function getMetadata(): array
    {
        return $this->metadata;
    }
}
