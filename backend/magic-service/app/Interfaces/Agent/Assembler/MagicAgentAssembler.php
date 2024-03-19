<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Agent\Assembler;

use App\Domain\Agent\Entity\MagicAgentEntity;
use App\Domain\Agent\VO\MagicAgentVO;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Agent\DTO\MagicAgentDTO;
use App\Interfaces\Flow\DTO\Flow\MagicFlowDTO;
use App\Interfaces\Kernel\DTO\PageDTO;

class MagicAgentAssembler
{
    public function createAgentDTO(MagicAgentEntity $agentEntity, array $avatars = []): MagicAgentDTO
    {
        $agentArray = $agentEntity->toArray();
        $DTO = new MagicAgentDTO($agentArray);

        $DTO->setAgentAvatar(FileAssembler::getUrl($avatars[$agentEntity->getAgentAvatar()] ?? null));
        $DTO->setAgentVersion($agentEntity->getLastVersionInfo());
        $DTO->setAgentName($agentEntity->getAgentName());
        $DTO->setAgentDescription($agentEntity->getAgentDescription());
        $DTO->setAgentVersionId($agentEntity->getAgentVersionId());
        return $DTO;
    }

    public function createPageListAgentDTO(int $total, array $list, Page $page, array $avatars = []): PageDTO
    {
        $list = array_map(fn (MagicAgentEntity $magicAgentEntity) => $this->createAgentDTO($magicAgentEntity, $avatars), $list);
        return new PageDTO($page->getPage(), $total, $list);
    }

    public static function createAgentV1Response(MagicAgentVO $magicAgentVO, MagicFlowDTO $magicFlowDTO): array
    {
        $agentEntity = $magicAgentVO->getAgentEntity();
        $agentArray = $agentEntity->toArray();
        $agentArray['bot_version_id'] = $agentEntity->getAgentVersionId();
        $agentArray['robot_avatar'] = $agentEntity->getAgentAvatar();
        $agentArray['robot_name'] = $agentEntity->getAgentName();
        $agentArray['robot_description'] = $agentEntity->getAgentDescription();

        $result['agent_version_entity'] = [];

        $magicAgentVersionEntity = $magicAgentVO->getAgentVersionEntity();
        if ($magicAgentVersionEntity) {
            $agentVersionArray = $magicAgentVersionEntity->toArray();
            $agentVersionArray['robot_version_id'] = $magicAgentVersionEntity->getAgentName();
            $agentVersionArray['robot_avatar'] = $magicAgentVersionEntity->getAgentAvatar();
            $agentVersionArray['robt_name'] = $magicAgentVersionEntity->getAgentName();
            $agentVersionArray['robot_description'] = $magicAgentVersionEntity->getAgentDescription();
            $result['agent_version_entity'] = $agentVersionArray;
        }

        $result = [];
        $result['agent_entity'] = $agentArray;
        $result['magic_user_entity'] = $magicAgentVO->getMagicUserEntity();
        $result['magic_flow_entity'] = $magicFlowDTO;
        $result['agent_version_entity'] = $magicAgentVO->getAgentVersionEntity();
        $result['is_add'] = $magicAgentVO->getIsAdd();

        $result['botVersionEntity'] = $magicAgentVO->getAgentVersionEntity();
        $result['botEntity'] = $agentArray;
        $result['magicUserEntity'] = $magicAgentVO->getMagicUserEntity();
        $result['magicFlowEntity'] = $magicFlowDTO;
        $result['isAdd'] = $magicAgentVO->getIsAdd();
        return $result;
    }
}
