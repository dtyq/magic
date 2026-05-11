<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use Dtyq\SuperMagic\Interfaces\Agent\Facade\Admin\OrganizationAdminSuperMagicAgentApi;
use Dtyq\SuperMagic\Interfaces\Skill\Facade\Admin\OrganizationAdminSkillApi;
use Hyperf\HttpServer\Router\Router;

// 组织后台审核接口。
// 仅用于组织管理员审核发布到组织内的版本，包括“全组织可见”和“指定成员/部门可见”。
// 官方员工/Skill 市场审核仍走 /api/v1/admin 或 /api/v2/admin 下的管理接口。
Router::addGroup('/api/v1/organization/admin', static function () {
    // 数字员工组织内发布审核。
    Router::addGroup('/super-magic/agents', static function () {
        // 查询组织内待审核/已审核的数字员工版本列表。
        Router::post('/versions/queries', [OrganizationAdminSuperMagicAgentApi::class, 'queryVersions']);
        // 审核通过后会发布该版本，并同步组织内可见范围。
        Router::put('/versions/{id}/approve', [OrganizationAdminSuperMagicAgentApi::class, 'approveVersion']);
        // 审核拒绝只更新审核状态，不改变当前生效版本和可见范围。
        Router::put('/versions/{id}/reject', [OrganizationAdminSuperMagicAgentApi::class, 'rejectVersion']);
    });

    // Skill 组织内发布审核。
    Router::addGroup('/skills', static function () {
        // 查询组织内待审核/已审核的 Skill 版本列表。
        Router::post('/versions/queries', [OrganizationAdminSkillApi::class, 'queryVersions']);
        // 审核通过后会发布该版本，并同步组织内可见范围。
        Router::put('/versions/{id}/approve', [OrganizationAdminSkillApi::class, 'approveVersion']);
        // 审核拒绝只更新审核状态，不改变当前生效版本和可见范围。
        Router::put('/versions/{id}/reject', [OrganizationAdminSkillApi::class, 'rejectVersion']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);
