<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'volcengine' => [
        'invalid_response_format' => 'Invalid response format from Volcengine',
        'submit_failed' => 'Failed to submit task to Volcengine API',
        'submit_exception' => 'Exception occurred while submitting task to Volcengine',
        'query_failed' => 'Failed to query result from Volcengine API',
        'query_exception' => 'Exception occurred while querying result from Volcengine',
        'config_incomplete' => 'Volcengine configuration is incomplete. Missing app_id, token, or cluster',
        'bigmodel' => [
            'invalid_response_format' => 'Invalid response format from BigModel ASR',
            'submit_exception' => 'Exception occurred while submitting task to BigModel ASR',
            'query_exception' => 'Exception occurred while querying result from BigModel ASR',
        ],
    ],
];
