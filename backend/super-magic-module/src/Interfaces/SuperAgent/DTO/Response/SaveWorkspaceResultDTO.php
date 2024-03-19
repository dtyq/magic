<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 工作区保存结果DTO
 * 用于封装工作区创建/更新操作的返回数据.
 */
class SaveWorkspaceResultDTO extends AbstractDTO
{
    /**
     * 工作区ID.
     */
    public string $id;

    /**
     * 构造函数.
     */
    public function __construct(?array $data = null)
    {
        parent::__construct($data);
    }

    /**
     * 从工作区ID创建DTO.
     *
     * @param int $id 工作区ID
     */
    public static function fromId(int $id): self
    {
        $dto = new self();
        $dto->id = (string) $id;
        return $dto;
    }

    /**
     * 获取工作区ID.
     */
    public function getId(): string
    {
        return $this->id;
    }

    /**
     * 设置工作区ID.
     *
     * @param int $id 工作区ID
     */
    public function setId(int $id): self
    {
        $this->id = (string) $id;
        return $this;
    }
}
