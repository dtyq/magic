<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'param_error' => 'param error',
    'not_found' => 'plugin not found',
    'name' => [
        'required' => 'name is required',
    ],
    'description' => [
        'required' => 'description is required',
    ],
    'type' => [
        'required' => 'type is required',
        'modification_not_allowed' => 'type is modification not allowed',
    ],
    'creator' => [
        'required' => 'creator is required',
    ],
    'api_config' => [
        'required' => 'api_config is required',
        'api_url' => [
            'required' => 'api_url is required',
            'invalid' => 'api_url is invalid',
        ],
        'auth_type' => [
            'required' => 'auth_type is required',
        ],
        'auth_config' => [
            'invalid' => 'auth_config is invalid',
        ],
    ],
];
