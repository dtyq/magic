<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Middleware\Auth\UserAuthMiddleware;
use Dtyq\SuperMagic\Interfaces\Skill\Facade\SkillApi;
use Dtyq\SuperMagic\Interfaces\Skill\Facade\SkillMarketApi;
use Hyperf\HttpServer\Router\Router;

Router::addGroup('/api/v1', static function () {
    // 市场技能库路由组
    Router::addGroup('/skill-market', static function () {
        // 获取市场技能库列表
        Router::post('/queries', [SkillMarketApi::class, 'queries']);

        // 获取市场技能详情
        Router::get('/{code}', [SkillMarketApi::class, 'show']);
    });

    Router::addGroup('/skills', static function () {
        // 获取用户技能列表
        Router::post('/queries', [SkillApi::class, 'queries']);

        // 获取我创建的技能列表
        Router::post('/queries/created', [SkillApi::class, 'queriesCreated']);

        // 获取团队共享的技能列表
        Router::post('/queries/team-shared', [SkillApi::class, 'queriesTeamShared']);

        // 获取从市场安装的技能列表
        Router::post('/queries/market-installed', [SkillApi::class, 'queriesMarketInstalled']);

        // 从 Agent 创建空技能
        Router::post('', [SkillApi::class, 'create']);

        // 从技能市场添加技能
        Router::post('/from-store', [SkillApi::class, 'addSkillFromStore']);

        // 技能导入第一阶段：上传文件并解析
        Router::post('/import/parse/file', [SkillApi::class, 'parseFileImport']);

        // 技能导入第二阶段：确认信息正式落库
        Router::post('/import', [SkillApi::class, 'importSkill']);

        // 获取用户技能详情
        Router::get('/{code}', [SkillApi::class, 'getSkillDetail']);

        // 删除用户技能（支持所有来源类型）
        Router::delete('/{code}', [SkillApi::class, 'deleteSkill']);

        // 更新技能基本信息（仅允许更新非商店来源的技能）
        Router::put('/{code}/info', [SkillApi::class, 'updateSkillInfo']);

        // 查询技能版本列表
        Router::get('/{code}/versions', [SkillApi::class, 'getVersionList']);

        // 发布表单预填（版本号、描述等，与 POST publish 请求体字段对齐）
        Router::get('/{code}/publish/prefill', [SkillApi::class, 'getPublishPrefill']);

        // 发布技能版本
        Router::post('/{code}/publish', [SkillApi::class, 'publishSkill']);

        // 下架技能版本
        //        Router::put('/{code}/offline', [SkillApi::class, 'offlineSkill']);

        // 批量获取技能 file_key 及下载 URL（仅返回当前用户自己的技能）
        Router::post('/file-urls', [SkillApi::class, 'getSkillFileUrls']);

        // 批量查询当前用户技能的最新已发布当前版本
        Router::post('/last-versions/queries', [SkillApi::class, 'queryLatestPublishedVersions']);
    });
}, ['middleware' => [RequestContextMiddleware::class, UserAuthMiddleware::class]]);
