<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'agent' => [
        'fields' => [
            'code' => 'Code',
            'codes' => 'Code List',
            'name' => 'Name',
            'description' => 'Description',
            'icon' => 'Icon',
            'type' => 'Type',
            'enabled' => 'Enabled',
            'prompt' => 'Prompt',
            'tools' => 'Tools',
            'tool_code' => 'Tool Code',
            'tool_name' => 'Tool Name',
            'tool_type' => 'Tool Type',
            // Common fields
            'page' => 'Page',
            'page_size' => 'Page Size',
            'creator_id' => 'Creator ID',
        ],
        'validation' => [
            // Basic field validation
            'name_required' => 'Agent name is required',
            'name_string' => 'Agent name must be a string',
            'name_max' => 'Agent name cannot exceed 80 characters',
            'description_string' => 'Agent description must be a string',
            'description_max' => 'Agent description cannot exceed 512 characters',
            'icon_array' => 'Agent icon must be in array format',
            'type_integer' => 'Agent type must be an integer',
            'type_invalid' => 'Invalid agent type',
            'enabled_boolean' => 'Enabled status must be a boolean value',
            'prompt_required' => 'Agent prompt is required',
            'prompt_array' => 'Agent prompt must be in array format',
            'tools_array' => 'Tools configuration must be in array format',

            // Tool field validation
            'tool_code_required' => 'Tool code is required',
            'tool_code_string' => 'Tool code must be a string',
            'tool_code_max' => 'Tool code cannot exceed 100 characters',
            'tool_name_required' => 'Tool name is required',
            'tool_name_string' => 'Tool name must be a string',
            'tool_name_max' => 'Tool name cannot exceed 100 characters',
            'tool_description_string' => 'Tool description must be a string',
            'tool_description_max' => 'Tool description cannot exceed 2048 characters',
            'tool_icon_string' => 'Tool icon must be a string',
            'tool_icon_max' => 'Tool icon cannot exceed 512 characters',
            'tool_type_required' => 'Tool type is required',
            'tool_type_integer' => 'Tool type must be an integer',
            'tool_type_invalid' => 'Invalid tool type',

            // Pagination validation
            'page_integer' => 'Page must be an integer',
            'page_min' => 'Page cannot be less than 1',
            'page_size_integer' => 'Page size must be an integer',
            'page_size_min' => 'Page size cannot be less than 1',
            'page_size_max' => 'Page size cannot exceed 1000',

            // Search condition validation
            'codes_array' => 'Code list must be in array format',
            'code_string' => 'Code must be a string',
            'code_max' => 'Code cannot exceed 50 characters',
            'creator_id_string' => 'Creator ID must be a string',
            'creator_id_max' => 'Creator ID cannot exceed 40 characters',

            // Order validation
            'frequent_array' => 'Frequent agents order must be in array format',
            'frequent_code_string' => 'Frequent agent code must be a string',
            'frequent_code_max' => 'Frequent agent code cannot exceed 50 characters',
            'all_array' => 'All agents order must be in array format',
            'all_code_string' => 'All agent code must be a string',
            'all_code_max' => 'All agent code cannot exceed 50 characters',
        ],
        'order' => [
            'frequent' => 'Frequent Agents',
            'all' => 'All Agents',
        ],
        'limit_exceeded' => 'Agent limit reached (:limit), cannot create more',
        'builtin_not_allowed' => 'This operation is not supported for built-in agents',
    ],
];
