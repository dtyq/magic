<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Admin\Agent\Assembler;

use App\Application\Admin\Agent\DTO\AdminAgentDetailDTO;
use App\Application\Admin\Agent\DTO\AdminAgentDTO;
use App\Domain\Agent\Entity\MagicAgentEntity;
use App\Domain\Agent\Entity\MagicAgentVersionEntity;

class AgentAssembler
{
    // entity 转 dto
    public static function entityToDTO(MagicAgentEntity $entity): AdminAgentDTO
    {
        return new AdminAgentDTO($entity->toArray());
    }

    public static function toAdminAgentDetail(MagicAgentEntity $agentEntity, MagicAgentVersionEntity $agentVersionEntity): AdminAgentDetailDTO
    {
        $adminAgentDetailDTO = new AdminAgentDetailDTO();
        $adminAgentDetailDTO->setId($agentEntity->getId());
        $adminAgentDetailDTO->setAgentName($agentVersionEntity->getAgentName());
        $adminAgentDetailDTO->setAgentDescription($agentVersionEntity->getAgentDescription());
        $adminAgentDetailDTO->setCreatedUid($agentEntity->getCreatedUid());
        $adminAgentDetailDTO->setVersionNumber($agentVersionEntity->getVersionNumber());
        $adminAgentDetailDTO->setStatus($agentEntity->getStatus());
        $adminAgentDetailDTO->setVisibilityConfig($agentVersionEntity->getVisibilityConfig());
        $adminAgentDetailDTO->setAgentAvatar($agentVersionEntity->getAgentAvatar());
        $adminAgentDetailDTO->setCreatedAt($agentVersionEntity->getCreatedAt());
        return $adminAgentDetailDTO;
    }
}
