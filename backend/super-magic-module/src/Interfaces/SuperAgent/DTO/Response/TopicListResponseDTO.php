<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;

class TopicListResponseDTO extends AbstractDTO
{
    /**
     * @var TopicItemDTO[] 话题列表
     */
    protected array $list = [];

    /**
     * @var int 总数
     */
    protected int $total = 0;

    /**
     * 从实体列表创建响应 DTO.
     */
    public static function fromResult(array $result): self
    {
        $dto = new self();
        $list = [];
        foreach ($result['list'] as $entity) {
            if ($entity instanceof TopicEntity) {
                $list[] = TopicItemDTO::fromEntity($entity);
            }
        }
        $dto->setList($list);
        $dto->setTotal($result['total']);
        return $dto;
    }

    public function getList(): array
    {
        return $this->list;
    }

    public function setList(array $list): self
    {
        $this->list = $list;
        return $this;
    }

    public function getTotal(): int
    {
        return $this->total;
    }

    public function setTotal(int $total): self
    {
        $this->total = $total;
        return $this;
    }
}
