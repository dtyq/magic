<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // 模式相关错误信息
    'validate_failed' => '参数校验失败',
    'mode_not_found' => '模式未找到',
    'mode_identifier_already_exists' => '模式标识已存在',
    'group_not_found' => '分组未找到',
    'group_name_already_exists' => '分组名称已存在',
    'invalid_distribution_type' => '无效的分配方式',
    'follow_mode_not_found' => '跟随的模式未找到',
    'cannot_follow_self' => '不能跟随自己',
    'mode_in_use_cannot_delete' => '模式正在使用中，无法删除',

    // 模式验证消息
    'name_required' => '模式名称是必需的',
    'name_max' => '模式名称不能超过100个字符',
    'name_i18n_required' => '模式国际化名称是必需的',
    'name_i18n_array' => '模式国际化名称必须是数组',
    'name_zh_cn_required' => '模式中文名称是必需的',
    'name_zh_cn_max' => '模式中文名称不能超过100个字符',
    'name_en_us_required' => '模式英文名称是必需的',
    'name_en_us_max' => '模式英文名称不能超过100个字符',
    'placeholder_i18n_array' => '占位符国际化必须是数组',
    'placeholder_zh_cn_max' => '占位符中文不能超过500个字符',
    'placeholder_en_us_max' => '占位符英文不能超过500个字符',
    'identifier_required' => '模式标识是必需的',
    'identifier_max' => '模式标识不能超过50个字符',
    'icon_max' => '图标URL不能超过255个字符',
    'color_max' => '颜色值不能超过10个字符',
    'color_regex' => '颜色值必须是有效的十六进制颜色码格式',
    'description_max' => '描述不能超过1000个字符',
    'distribution_type_required' => '分配方式是必需的',
    'distribution_type_in' => '分配方式必须是1（独立配置）或2（继承配置）',
    'follow_mode_id_integer' => '跟随模式ID必须是整数',
    'follow_mode_id_min' => '跟随模式ID必须大于0',
    'restricted_mode_identifiers_array' => '限制模式标识必须是数组',

    // 分组验证消息
    'mode_id_required' => '模式ID是必需的',
    'mode_id_integer' => '模式ID必须是整数',
    'mode_id_min' => '模式ID必须大于0',
    'group_name_required' => '分组名称是必需的',
    'group_name_max' => '分组名称不能超过100个字符',
    'group_name_zh_cn_required' => '分组中文名称是必需的',
    'group_name_zh_cn_max' => '分组中文名称不能超过100个字符',
    'group_name_en_us_required' => '分组英文名称是必需的',
    'group_name_en_us_max' => '分组英文名称不能超过100个字符',
    'sort_integer' => '排序权重必须是整数',
    'sort_min' => '排序权重不能小于0',
    'status_integer' => '状态必须是整数',
    'status_in' => '状态必须是0（禁用）或1（启用）',
    'status_boolean' => '状态必须是布尔值',

    // 分组配置相关
    'groups_required' => '分组配置是必需的',
    'groups_array' => '分组配置必须是数组',
    'groups_min' => '至少需要配置一个分组',
    'model_ids_array' => '模型ID列表必须是数组',
    'model_id_integer' => '模型ID必须是整数',
    'model_id_min' => '模型ID必须大于0',
    'models_array' => '模型列表必须是数组',
    'model_id_required' => '模型ID是必需的',
    'model_sort_integer' => '模型排序权重必须是整数',
    'model_sort_min' => '模型排序权重不能小于0',
];
