<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Response;

/**
 * 生成资源ID响应DTO.
 */
class GenerateResourceIdResponseDTO
{
    /**
     * @var string 资源ID
     */
    public string $id = '';

    /**
     * 将DTO转换为数组.
     *
     * @return array 关联数组
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
        ];
    }
}
