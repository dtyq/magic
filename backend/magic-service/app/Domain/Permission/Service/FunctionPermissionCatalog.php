<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Service;

final class FunctionPermissionCatalog
{
    /**
     * @return array<string, array<string, mixed>>
     */
    public static function definitions(): array
    {
        return [
            'skill.create' => [
                'function_code' => 'skill.create',
                'module_code' => 'skill',
                'function_name_key' => 'permission.function_permission.functions.skill_create.name',
                'module_name_key' => 'permission.function_permission.modules.skill',
                'description_key' => 'permission.function_permission.functions.skill_create.description',
                'default_binding_scope' => ['type' => 'organization_all'],
            ],
            'skill.publish_team' => [
                'function_code' => 'skill.publish_team',
                'module_code' => 'skill',
                'function_name_key' => 'permission.function_permission.functions.skill_publish_team.name',
                'module_name_key' => 'permission.function_permission.modules.skill',
                'description_key' => 'permission.function_permission.functions.skill_publish_team.description',
                'default_binding_scope' => ['type' => 'organization_all'],
            ],
            'agent.create' => [
                'function_code' => 'agent.create',
                'module_code' => 'agent',
                'function_name_key' => 'permission.function_permission.functions.agent_create.name',
                'module_name_key' => 'permission.function_permission.modules.agent',
                'description_key' => 'permission.function_permission.functions.agent_create.description',
                'default_binding_scope' => ['type' => 'organization_all'],
            ],
            'agent.publish_team' => [
                'function_code' => 'agent.publish_team',
                'module_code' => 'agent',
                'function_name_key' => 'permission.function_permission.functions.agent_publish_team.name',
                'module_name_key' => 'permission.function_permission.modules.agent',
                'description_key' => 'permission.function_permission.functions.agent_publish_team.description',
                'default_binding_scope' => ['type' => 'organization_all'],
            ],
            'magic_claw.create' => [
                'function_code' => 'magic_claw.create',
                'module_code' => 'magic_claw',
                'function_name_key' => 'permission.function_permission.functions.magic_claw_create.name',
                'module_name_key' => 'permission.function_permission.modules.magic_claw',
                'description_key' => 'permission.function_permission.functions.magic_claw_create.description',
                'default_binding_scope' => ['type' => 'organization_all'],
            ],
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public static function all(): array
    {
        return self::definitions();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function list(): array
    {
        return array_values(self::definitions());
    }

    public static function exists(string $functionCode): bool
    {
        return isset(self::definitions()[$functionCode]);
    }

    /**
     * @return array<string, mixed>
     */
    public static function find(string $functionCode): array
    {
        return self::definitions()[$functionCode] ?? [];
    }
}
