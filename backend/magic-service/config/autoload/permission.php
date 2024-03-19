<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use function Hyperf\Support\env;

$organizationWhitelists = parse_json_config(env('ORGANIZATION_WHITELISTS'));
$superWhitelists = parse_json_config(env('SUPER_WHITELISTS', '[]'));
return [
    // 超级管理员
    'super_whitelists' => $superWhitelists,
    // 由于暂时没有权限系统，env 配置组织的管理员
    'organization_whitelists' => $organizationWhitelists,
    // 兼容模式：当 RBAC 角色未对齐时，使用组织管理员表兜底补充权限组（仅运行时生效，不写库）
    'enable_organization_admin_permission_fallback' => (bool) env('ENABLE_ORGANIZATION_ADMIN_PERMISSION_FALLBACK', true),
];
