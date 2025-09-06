<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Util\Middleware\RequestContextMiddleware;
use App\Interfaces\Chat\Facade\MagicChatAdminContactApi;
use App\Interfaces\Chat\Facade\MagicChatHttpApi;
use App\Interfaces\Chat\Facade\MagicChatUserApi;
use App\Interfaces\Contact\Facade\MagicUserOrganizationApi;
use App\Interfaces\Contact\Facade\MagicUserSettingApi;
use Hyperf\HttpServer\Router\Router;

// Account-related routes (independent of RequestContextMiddleware to support cross-organization queries)
Router::addGroup('/api/v1/contact/accounts', function () {
    // Get user details for all organizations under the current account
    Router::get('/me/users', [MagicChatUserApi::class, 'getAccountUsersDetail']);
    // 获取我的当前组织
    Router::get('/me/organization-code', [MagicUserOrganizationApi::class, 'getCurrentOrganizationCode']);
    // 修改我的当前组织
    Router::put('/me/organization-code', [MagicUserOrganizationApi::class, 'setCurrentOrganizationCode']);
});

// 通讯录（需要组织上下文）
Router::addGroup('/api/v1/contact', static function () {
    // 用户相关
    Router::addGroup('/users', static function () {
        // 用户所在群组列表
        Router::get('/self/groups', [MagicChatHttpApi::class, 'getUserGroupList']);
        // 更新用户信息
        Router::patch('/me', [MagicChatUserApi::class, 'updateUserInfo']);
        // 是否允许更新用户信息
        Router::get('/me/update-permission', [MagicChatUserApi::class, 'getUserUpdatePermission']);
        // 按用户 id 批量查询
        Router::post('/queries', [MagicChatAdminContactApi::class, 'userGetByIds']);
        // 按手机号/昵称等查询
        Router::get('/search', [MagicChatAdminContactApi::class, 'searchForSelect']);
        // 设置隐藏用户
        Router::put('/visibility', [MagicChatAdminContactApi::class, 'updateUsersOptionByIds']);

        // 用户设置相关
        Router::addGroup('/setting', static function () {
            Router::post('', [MagicUserSettingApi::class, 'save']);
            Router::get('/{key}', [MagicUserSettingApi::class, 'get']);
            Router::post('/queries', [MagicUserSettingApi::class, 'queries']);

            // 超级麦吉话题模型配置
            Router::put('/super-magic/topic-model/{topicId}', [MagicUserSettingApi::class, 'saveProjectTopicModelConfig']);
            Router::get('/super-magic/topic-model/{topicId}', [MagicUserSettingApi::class, 'getProjectTopicModelConfig']);
        });
    });

    // 部门相关
    Router::addGroup('/departments', static function () {
        Router::get('/{id}/children', [MagicChatAdminContactApi::class, 'getSubList']);
        Router::get('/search', [MagicChatAdminContactApi::class, 'departmentSearch']);
        Router::get('/{id}', [MagicChatAdminContactApi::class, 'getDepartmentInfoById']);
        // 部门下的用户
        Router::get('/{id}/users', [MagicChatAdminContactApi::class, 'departmentUserList']);
        // 设置隐藏部门
        Router::put('/visibility', [MagicChatAdminContactApi::class, 'updateDepartmentsOptionByIds']);
    });

    // 群组
    Router::addGroup('/groups', static function () {
        // 批量获取群信息（名称、公告等）
        Router::post('/queries', [MagicChatHttpApi::class, 'getMagicGroupList']);
        Router::post('', [MagicChatHttpApi::class, 'createChatGroup']);
        Router::put('/{id}', [MagicChatHttpApi::class, 'GroupUpdateInfo']);
        // 群成员管理
        Router::get('/{id}/members', [MagicChatHttpApi::class, 'getGroupUserList']);
        // 批量添加群成员
        Router::post('/{id}/members', [MagicChatHttpApi::class, 'groupAddUsers']);
        // 批量移除群成员
        Router::delete('/{id}/members', [MagicChatHttpApi::class, 'groupKickUsers']);
        // 主动退群
        Router::delete('/{id}/members/self', [MagicChatHttpApi::class, 'leaveGroupConversation']);
        // 群主转让
        Router::put('/{id}/owner', [MagicChatHttpApi::class, 'groupTransferOwner']);
        Router::delete('/{id}', [MagicChatHttpApi::class, 'groupDelete']);
    });

    // 好友
    Router::addGroup('/friends', static function () {
        Router::post('/{friendId}', [MagicChatUserApi::class, 'addFriend']);
        Router::get('', [MagicChatUserApi::class, 'getUserFriendList']);
    });
}, ['middleware' => [RequestContextMiddleware::class]]);
