<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileVersionEntity;

/**
 * 获取文件版本列表响应DTO.
 */
class GetFileVersionsResponseDTO extends AbstractDTO
{
    protected array $list = [];

    protected int $total = 0;

    protected int $page = 1;

    public function getList(): array
    {
        return $this->list;
    }

    public function setList(array $list): void
    {
        $this->list = $list;
    }

    public function getTotal(): int
    {
        return $this->total;
    }

    public function setTotal(int $total): void
    {
        $this->total = $total;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function setPage(int $page): void
    {
        $this->page = $page;
    }

    /**
     * 从实体数组创建响应DTO.
     *
     * @param TaskFileVersionEntity[] $entities 文件版本实体数组
     * @param int $total 总数
     * @param int $page 当前页码
     */
    public static function fromData(array $entities, int $total, int $page): self
    {
        $dto = new self();
        $dto->setTotal($total);
        $dto->setPage($page);

        $list = [];
        foreach ($entities as $entity) {
            $list[] = [
                'id' => $entity->getId(),
                'file_id' => $entity->getFileId(),
                'file_key' => $entity->getFileKey(),
                'version' => $entity->getVersion(),
                'created_at' => $entity->getCreatedAt(),
                'updated_at' => $entity->getUpdatedAt(),
            ];
        }

        $dto->setList($list);
        return $dto;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'list' => $this->list,
            'total' => $this->total,
            'page' => $this->page,
        ];
    }
}
