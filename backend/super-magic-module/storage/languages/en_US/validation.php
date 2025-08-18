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
];
