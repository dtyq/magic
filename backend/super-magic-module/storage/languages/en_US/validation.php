<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'file_key_required' => 'File key is required',
    'file_name_required' => 'File name is required',
    'file_size_required' => 'File size is required',
    'project' => [
        'id' => [
            'required' => 'Project ID is required',
            'string' => 'Project ID must be a string',
        ],
        'members' => [
            'required' => 'Members list is required',
            'array' => 'Members list must be an array',
            'min' => 'At least one member is required',
            'max' => 'Cannot have more than :max members',
        ],
        'target_type' => [
            'required' => 'Member type is required',
            'string' => 'Member type must be a string',
            'in' => 'Member type must be User or Department',
        ],
        'target_id' => [
            'required' => 'Member ID is required',
            'string' => 'Member ID must be a string',
            'max' => 'Member ID cannot exceed :max characters',
        ],
    ],
    // Schedule time validation
    'schedule_time' => [
        'no_repeat' => [
            'day_required' => 'Day is required for no_repeat type',
            'time_required' => 'Time is required for no_repeat type',
            'must_be_future' => 'Scheduled time must be in the future',
            'must_be_at_least_5_minutes' => 'Scheduled time must be at least 5 minutes from now',
            'invalid_date_time_format' => 'Invalid date or time format',
        ],
        'daily_repeat' => [
            'time_required' => 'Time is required for daily_repeat type',
        ],
        'weekly_repeat' => [
            'day_required' => 'Day is required for weekly_repeat type',
            'time_required' => 'Time is required for weekly_repeat type',
            'day_range' => 'Day must be between 0-6 for weekly_repeat type',
        ],
        'monthly_repeat' => [
            'day_required' => 'Day is required for monthly_repeat type',
            'time_required' => 'Time is required for monthly_repeat type',
            'day_range' => 'Day must be between 1-31 for monthly_repeat type',
        ],
        'annually_repeat' => [
            'day_required' => 'Day is required for annually_repeat type',
            'time_required' => 'Time is required for annually_repeat type',
        ],
        'weekday_repeat' => [
            'time_required' => 'Time is required for weekday_repeat type',
        ],
        'custom_repeat' => [
            'day_required' => 'Day is required for custom_repeat type',
            'time_required' => 'Time is required for custom_repeat type',
            'unit_required' => 'Unit is required for custom_repeat type',
            'interval_required' => 'Interval is required for custom_repeat type',
            'values_required' => 'Values are required for week and month units in custom_repeat type',
        ],
    ],
];
