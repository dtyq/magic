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
        ],
        'order' => [
            'frequent' => 'Frequent Agents',
            'all' => 'All Agents',
        ],
        'limit_exceeded' => 'Agent limit reached (:limit), cannot create more',
        'builtin_not_allowed' => 'This operation is not supported for built-in agents',
    ],
];
