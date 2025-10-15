<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'file_key_required' => '文件键不能为空',
    'file_name_required' => '文件名不能为空',
    'file_size_required' => '文件大小不能为空',
    'project' => [
        'id' => [
            'required' => '项目ID不能为空',
            'string' => '项目ID必须是字符串',
        ],
        'members' => [
            'required' => '成员列表不能为空',
            'array' => '成员列表必须是数组格式',
            'min' => '至少需要添加一个成员',
            'max' => '成员数量不能超过:max个',
        ],
        'target_type' => [
            'required' => '成员类型不能为空',
            'string' => '成员类型必须是字符串',
            'in' => '成员类型只能是User或Department',
        ],
        'target_id' => [
            'required' => '成员ID不能为空',
            'string' => '成员ID必须是字符串',
            'max' => '成员ID长度不能超过:max个字符',
        ],
    ],
    // Schedule time validation
    'schedule_time' => [
        'no_repeat' => [
            'day_required' => '不重复类型的定时任务必须指定日期',
            'time_required' => '不重复类型的定时任务必须指定时间',
            'must_be_future' => '定时任务的执行时间必须是未来时间',
            'must_be_at_least_5_minutes' => '定时任务的执行时间必须至少在当前时间 5 分钟之后',
            'invalid_date_time_format' => '日期或时间格式无效',
        ],
        'daily_repeat' => [
            'time_required' => '每天重复类型的定时任务必须指定时间',
        ],
        'weekly_repeat' => [
            'day_required' => '每周重复类型的定时任务必须指定日期',
            'time_required' => '每周重复类型的定时任务必须指定时间',
            'day_range' => '每周重复类型的日期必须在 0-6 之间',
        ],
        'monthly_repeat' => [
            'day_required' => '每月重复类型的定时任务必须指定日期',
            'time_required' => '每月重复类型的定时任务必须指定时间',
            'day_range' => '每月重复类型的日期必须在 1-31 之间',
        ],
        'annually_repeat' => [
            'day_required' => '每年重复类型的定时任务必须指定日期',
            'time_required' => '每年重复类型的定时任务必须指定时间',
        ],
        'weekday_repeat' => [
            'time_required' => '工作日重复类型的定时任务必须指定时间',
        ],
        'custom_repeat' => [
            'day_required' => '自定义重复类型的定时任务必须指定日期',
            'time_required' => '自定义重复类型的定时任务必须指定时间',
            'unit_required' => '自定义重复类型的定时任务必须指定单位',
            'interval_required' => '自定义重复类型的定时任务必须指定间隔',
            'values_required' => '自定义重复类型的周和月单位必须指定值',
        ],
    ],
];
