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
        // 审核数字员工版本。APPROVED 会发布该版本并同步组织内可见范围；REJECTED 只更新审核状态。
        Router::put('/versions/{id}/review', [OrganizationAdminSuperMagicAgentApi::class, 'reviewVersion']);
    });

    // Skill 组织内发布审核。
    Router::addGroup('/skills', static function () {
        // 查询组织内待审核/已审核的 Skill 版本列表。
        Router::post('/versions/queries', [OrganizationAdminSkillApi::class, 'queryVersions']);
        // 审核 Skill 版本。APPROVED 会发布该版本并同步组织内可见范围；REJECTED 只更新审核状态。
        Router::put('/versions/{id}/review', [OrganizationAdminSkillApi::class, 'reviewVersion']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);
