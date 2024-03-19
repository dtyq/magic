<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MCP\Assembler;

use App\Domain\MCP\Entity\MCPUserSettingEntity;
use App\Interfaces\MCP\DTO\MCPUserSettingDTO;

class MCPUserSettingAssembler
{
    public static function createDTO(array $settings): MCPUserSettingDTO
    {
        $dto = new MCPUserSettingDTO();
        $dto->setRequireFields($settings['require_fields'] ?? []);
        $dto->setAuthType($settings['auth_type'] ?? null);
        $dto->setAuthConfig($settings['auth_config'] ?? null);

        return $dto;
    }

    public static function createSaveResultDTO(MCPUserSettingEntity $entity): MCPUserSettingDTO
    {
        $dto = new MCPUserSettingDTO();
        $dto->setRequireFields($entity->getRequireFieldsAsArray());

        return $dto;
    }
}
