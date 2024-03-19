<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 协作项目创建者列表响应 DTO.
 */
class CollaborationCreatorListResponseDTO extends AbstractDTO
{
    /**
     * @var CollaborationCreatorItemDTO[] 创建者列表
     */
    protected array $creators = [];

    /**
     * 从用户实体数组创建响应DTO.
     *
     * @param array $userEntities 用户实体数组
     */
    public static function fromUserEntities(array $userEntities): self
    {
        $dto = new self();

        $creatorItems = [];
        foreach ($userEntities as $userEntity) {
            $creatorItems[] = CollaborationCreatorItemDTO::fromUserEntity($userEntity);
        }

        $dto->setCreators($creatorItems);
        return $dto;
    }

    /**
     * 创建空的响应DTO.
     */
    public static function fromEmpty(): self
    {
        return new self();
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return array_map(fn (CollaborationCreatorItemDTO $creator) => $creator->toArray(), $this->creators);
    }

    /**
     * 获取创建者列表.
     *
     * @return CollaborationCreatorItemDTO[]
     */
    public function getCreators(): array
    {
        return $this->creators;
    }

    /**
     * 设置创建者列表.
     *
     * @param CollaborationCreatorItemDTO[] $creators
     */
    public function setCreators(array $creators): self
    {
        $this->creators = $creators;
        return $this;
    }
}
