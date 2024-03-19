<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\Assembler\AppMenu;

use App\Domain\AppMenu\Entity\AppMenuEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Admin\DTO\AppMenu\AppMenuDTO;
use App\Interfaces\Admin\DTO\AppMenu\AppMenuListItemDTO;
use App\Interfaces\Kernel\Assembler\FileAssembler;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;
use Dtyq\CloudFile\Kernel\Struct\FileLink;

class AppMenuAssembler
{
    /**
     * @param array<string, MagicUserEntity> $users
     * @param array<string, FileLink> $icons
     */
    public static function createDTO(AppMenuEntity $entity, array $users = [], array $icons = []): AppMenuDTO
    {
        $dto = new AppMenuDTO();
        $iconUrl = '';
        if ($entity->isImageIcon()) {
            $iconUrl = FileAssembler::getUrl($icons[$entity->getIconUrl()] ?? null);
            if ($iconUrl === '') {
                $iconUrl = $entity->getIconUrl();
            }
        }

        $dto->setId($entity->getId());
        $dto->setNameI18n($entity->getNameI18n());
        $dto->setIcon($entity->getIcon());
        $dto->setIconUrl($iconUrl);
        $dto->setIconType($entity->getIconType());
        $dto->setPath($entity->getPath());
        $dto->setOpenMethod($entity->getOpenMethod());
        $dto->setSortOrder($entity->getSortOrder());
        $dto->setDisplayScope($entity->getDisplayScope());
        $dto->setStatus($entity->getStatus());
        $dto->setCreator($entity->getCreatorId());
        $dto->setCreatedAt($entity->getCreatedAt());
        $dto->setUpdatedAt($entity->getUpdatedAt());
        $dto->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity(
            $users[$entity->getCreatorId()] ?? null,
            $entity->getCreatedAt()
        ));

        return $dto;
    }

    /**
     * 列表项 DTO，仅含表字段，不含 creator_info 等运营人信息.
     *
     * @param array<string, FileLink> $icons
     */
    public static function createListDTO(AppMenuEntity $entity, array $icons = []): AppMenuListItemDTO
    {
        $dto = new AppMenuListItemDTO();
        $iconUrl = '';
        if ($entity->isImageIcon()) {
            $iconUrl = FileAssembler::getUrl($icons[$entity->getIconUrl()] ?? null);
            if ($iconUrl === '') {
                $iconUrl = $entity->getIconUrl();
            }
        }

        $dto->setId($entity->getId());
        $dto->setNameI18n($entity->getNameI18n());
        $dto->setIcon($entity->getIcon());
        $dto->setIconUrl($iconUrl);
        $dto->setIconType($entity->getIconType());
        $dto->setPath($entity->getPath());
        $dto->setOpenMethod($entity->getOpenMethod());
        $dto->setSortOrder($entity->getSortOrder());
        $dto->setDisplayScope($entity->getDisplayScope());
        $dto->setStatus($entity->getStatus());
        $dto->setCreatorId($entity->getCreatorId());
        $dto->setCreatedAt($entity->getCreatedAt());
        $dto->setUpdatedAt($entity->getUpdatedAt());

        return $dto;
    }

    public static function createEntity(AppMenuDTO $dto): AppMenuEntity
    {
        $entity = new AppMenuEntity();
        $id = $dto->getId();
        $entity->setId($id === null || $id === '' ? null : (int) $id);
        $entity->setNameI18n($dto->getNameI18n());
        $entity->setIconType($dto->getIconType());
        $entity->setIcon($dto->getIcon());
        $entity->setIconUrl(FileAssembler::formatPath($dto->getIconUrl()));
        $entity->setPath($dto->getPath());
        $entity->setOpenMethod($dto->getOpenMethod());
        $entity->setSortOrder($dto->getSortOrder());
        $entity->setDisplayScope($dto->getDisplayScope());
        $entity->setStatus($dto->getStatus());

        return $entity;
    }

    /**
     * 分页列表，仅含表字段（供 queries 接口）.
     *
     * @param array<AppMenuEntity> $list
     * @param array<string, FileLink> $icons
     */
    public static function createPageListDTO(int $total, array $list, Page $page, array $icons = []): PageDTO
    {
        $dtoList = array_map(
            fn (AppMenuEntity $entity): AppMenuListItemDTO => self::createListDTO($entity, $icons),
            $list
        );

        return new PageDTO($page->getPage(), $total, $dtoList);
    }
}
