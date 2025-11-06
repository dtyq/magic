<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'default_project_name' => '默认项目',
    'project_not_found' => '项目未找到',
    'project_name_already_exists' => '项目名称已存在',
    'project_access_denied' => '没有权限访问该项目',
    'create_project_failed' => '创建项目失败',
    'update_project_failed' => '更新项目失败',
    'delete_project_failed' => '删除项目失败',
    'work_dir' => [
        'not_found' => '项目工作目录未找到',
    ],
    'department_not_found' => '部门不存在',
    'invalid_member_type' => '无效的成员类型',
    'invalid_member_role' => '无效的成员角色',
    'update_members_failed' => '更新成员失败',
    'member_validation_failed' => '成员验证失败',
    'cannot_set_shortcut_for_own_project' => '不能为自己的项目设置快捷方式',
    'project_id_required_for_collaboration' => '在协作空间中创建定时任务，需要选择一个项目',
    'not_a_collaboration_project' => '您没有权限访问该协作项目，请联系项目管理员',

    // 操作日志相关
    'operation_log' => [
        'not_found' => '操作日志记录不存在',
    ],

    // 成员类型描述
    'member_type' => [
        'user' => '用户',
        'department' => '部门',
    ],

    // 成员状态描述
    'member_status' => [
        'active' => '激活',
        'inactive' => '非激活',
    ],

    // 成员角色描述
    'member_role' => [
        'manage' => '可管理',
        'owner' => '所有者',
        'editor' => '编辑者',
        'viewer' => '查看者',
    ],

    // 团队邀请功能错误消息
    'no_invite_permission' => '您没有权限邀请成员',
    'collaboration_disabled' => '项目协作功能已关闭',
    'invalid_permission_level' => '无效的权限级别',
    'no_manage_permission' => '您没有管理权限',
    'cannot_remove_creator' => '不能移除项目创建者',
    'last_manager_cannot_be_removed' => '至少需要保留一个管理员',
    'duplicate_member' => '成员已存在',
    'member_not_found' => '成员不存在',
    'invalid_target_type' => '无效的目标类型',
    'cannot_remove_self' => '不能移除自己',
    'members_added' => '团队成员添加成功',
    'collaboration_enabled' => '项目协作已开启',
    'collaboration_updated' => '项目协作设置已更新',
    'batch_permission_updated' => '批量权限设置成功',
    'batch_members_deleted' => '批量删除成员成功',
];
