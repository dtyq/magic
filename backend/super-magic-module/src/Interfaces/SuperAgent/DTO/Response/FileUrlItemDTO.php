<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class FileUrlItemDTO extends AbstractDTO
{
    /**
     * 文件ID.
     */
    public string $fileId;

    /**
     * 文件URL.
     */
    public string $fileUrl;

    /**
     * 构造函数.
     */
    public function __construct(string $fileId = '', string $fileUrl = '')
    {
        $this->fileId = $fileId;
        $this->fileUrl = $fileUrl;
    }

    /**
     * 从数组创建DTO.
     */
    public static function fromArray(array $data): self
    {
        $dto = new self();
        $dto->fileId = (string) ($data['file_id'] ?? '');
        $dto->fileUrl = $data['file_url'] ?? '';

        return $dto;
    }

    /**
     * 转换为数组.
     * 输出保持下划线命名，以保持API兼容性.
     */
    public function toArray(): array
    {
        return [
            'file_id' => $this->fileId,
            'file_url' => $this->fileUrl,
        ];
    }
}
