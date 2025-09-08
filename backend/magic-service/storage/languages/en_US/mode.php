<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // Mode related error messages
    'validate_failed' => 'Parameter validation failed',
    'mode_not_found' => 'Mode not found',
    'mode_identifier_already_exists' => 'Mode identifier already exists',
    'group_not_found' => 'Group not found',
    'group_name_already_exists' => 'Group name already exists',
    'invalid_distribution_type' => 'Invalid distribution type',
    'follow_mode_not_found' => 'Follow mode not found',
    'cannot_follow_self' => 'Cannot follow self',
    'mode_in_use_cannot_delete' => 'Mode is in use and cannot be deleted',

    // Mode validation messages
    'name_required' => 'Mode name is required',
    'name_max' => 'Mode name cannot exceed 100 characters',
    'name_i18n_required' => 'Mode internationalized name is required',
    'name_i18n_array' => 'Mode internationalized name must be an array',
    'name_zh_cn_required' => 'Mode Chinese name is required',
    'name_zh_cn_max' => 'Mode Chinese name cannot exceed 100 characters',
    'name_en_us_required' => 'Mode English name is required',
    'name_en_us_max' => 'Mode English name cannot exceed 100 characters',
    'placeholder_i18n_array' => 'Placeholder internationalization must be an array',
    'placeholder_zh_cn_max' => 'Placeholder Chinese cannot exceed 500 characters',
    'placeholder_en_us_max' => 'Placeholder English cannot exceed 500 characters',
    'identifier_required' => 'Mode identifier is required',
    'identifier_max' => 'Mode identifier cannot exceed 50 characters',
    'icon_max' => 'Icon URL cannot exceed 255 characters',
    'color_max' => 'Color value cannot exceed 10 characters',
    'color_regex' => 'Color value must be a valid hexadecimal color code format',
    'description_max' => 'Description cannot exceed 1000 characters',
    'distribution_type_required' => 'Distribution type is required',
    'distribution_type_in' => 'Distribution type must be 1 (independent configuration) or 2 (inherited configuration)',
    'follow_mode_id_integer' => 'Follow mode ID must be an integer',
    'follow_mode_id_min' => 'Follow mode ID must be greater than 0',
    'restricted_mode_identifiers_array' => 'Restricted mode identifiers must be an array',

    // Group validation messages
    'mode_id_required' => 'Mode ID is required',
    'mode_id_integer' => 'Mode ID must be an integer',
    'mode_id_min' => 'Mode ID must be greater than 0',
    'group_name_required' => 'Group name is required',
    'group_name_max' => 'Group name cannot exceed 100 characters',
    'group_name_zh_cn_required' => 'Group Chinese name is required',
    'group_name_zh_cn_max' => 'Group Chinese name cannot exceed 100 characters',
    'group_name_en_us_required' => 'Group English name is required',
    'group_name_en_us_max' => 'Group English name cannot exceed 100 characters',
    'sort_integer' => 'Sort weight must be an integer',
    'sort_min' => 'Sort weight cannot be less than 0',
    'status_integer' => 'Status must be an integer',
    'status_in' => 'Status must be 0 (disabled) or 1 (enabled)',
    'status_boolean' => 'Status must be a boolean',

    // Group configuration related
    'groups_required' => 'Group configuration is required',
    'groups_array' => 'Group configuration must be an array',
    'groups_min' => 'At least one group must be configured',
    'model_ids_array' => 'Model ID list must be an array',
    'model_id_integer' => 'Model ID must be an integer',
    'model_id_min' => 'Model ID must be greater than 0',
    'models_array' => 'Model list must be an array',
    'model_id_required' => 'Model ID is required',
    'model_sort_integer' => 'Model sort weight must be an integer',
    'model_sort_min' => 'Model sort weight cannot be less than 0',
];
