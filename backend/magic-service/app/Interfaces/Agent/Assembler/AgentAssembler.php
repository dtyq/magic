<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Agent\Assembler;

use App\Domain\Agent\Entity\MagicAgentEntity;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Agent\DTO\AvailableAgentDTO;
use App\Interfaces\Kernel\Assembler\FileAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;
use Dtyq\CloudFile\Kernel\Struct\FileLink;

class AgentAssembler
{
    /**
     * @param array<string, FileLink> $icons
     */
    public static function createAvailableAgentDTO(MagicAgentEntity $agentEntity, array $icons = []): AvailableAgentDTO
    {
        $dto = new AvailableAgentDTO();
        $dto->setId($agentEntity->getId());
        $dto->setName($agentEntity->getAgentName());
        $dto->setAvatar(FileAssembler::getUrl($icons[$agentEntity->getAgentAvatar()] ?? null));
        $dto->setDescription($agentEntity->getAgentDescription());
        $dto->setCreatedAt($agentEntity->getCreatedAt());
        return $dto;
    }

    public static function createAvailableList(Page $page, int $total, array $list, array $icons = []): PageDTO
    {
        $list = array_map(fn (MagicAgentEntity $entity) => self::createAvailableAgentDTO($entity, $icons), $list);
        return new PageDTO($page->getPage(), $total, $list);
    }

    public static function createChatModelAvailableList(Page $page, int $total, array $list, array $icons = []): PageDTO
    {
        // 处理分页
        $offset = ($page->getPage() - 1) * $page->getPageNum();
        $pagedList = array_slice($list, $offset, $page->getPageNum());

        // 直接返回数组数据，因为已经包含会话ID等信息
        return new PageDTO($page->getPage(), $total, $pagedList);
    }
}
