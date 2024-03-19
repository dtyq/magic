<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Infrastructure\Core\PHPSandbox\ExecutableCode\Methods\LogicalIfMethod;
use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods\Date\GetISO8601Date;
use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods\Date\GetISO8601DateTime;
use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods\Date\GetISO8601DateTimeWithOffset;
use Dtyq\FlowExprEngine\Kernel\RuleEngine\PHPSandbox\ExecutableCode\Methods\Date\GetRFC1123DateTime;

return [
    'logger' => [
        'enabled' => false,
    ],
    // 使用 php_sandbox 执行代码时，允许使用的 php 函数
    'php_sandbox_functions' => [
        [
            'group' => '字符串',
            'functions' => [
                'str_contains', 'str_replace', 'mb_strlen', 'mb_str_pad', 'explode',
                'preg_replace', 'preg_split', 'str_repeat', 'str_split',
                'strpos', 'strlen', 'substr', 'ltrim', 'rtrim', 'trim',
                'strtolower', 'strtoupper', 'str_starts_with', 'str_ends_with', 'str_pad',
                'sprintf', 'uniqid', 'htmlspecialchars', 'htmlentities', 'strip_tags', 'nl2br', 'wordwrap',
                'addslashes', 'stripslashes', 'substr_replace', 'strtr', 'str_shuffle', 'chunk_split',
            ],
        ],
        [
            'group' => '数组',
            'functions' => [
                'array_count_values', 'array_fill', 'array_fill_keys', 'array_filter', 'array_map', 'array_reduce',
                'array_replace', 'array_replace_recursive', 'end', 'current', 'key', 'list', 'array_key_exists', 'array_keys',
                'array_change_key_case', 'array_chunk', 'array_combine', 'array_slice',
                'array_column', 'array_values', 'array_merge', 'array_diff', 'array_intersect', 'array_unique',
                'array_search', 'array_flip', 'array_reverse', 'array_splice', 'in_array', 'shuffle',
                'array_walk', 'array_walk_recursive', 'array_push', 'array_pop', 'array_shift', 'array_unshift',
            ],
        ],
        [
            'group' => '数学运算',
            'functions' => [
                'abs', 'ceil', 'floor', 'round', 'sqrt', 'pow', 'exp', 'log', 'log10', 'sin', 'cos', 'tan', 'asin', 'acos',
                'atan', 'atan2', 'pi', 'fmod', 'rand', 'mt_rand', 'mt_srand', 'random_int', 'random_bytes', 'min', 'max', 'intdiv',
                'bcadd', 'bcsub', 'bcmul', 'bcdiv', 'bcpow', 'bcsqrt', 'bcmod',
            ],
        ],
        [
            'group' => '序列化',
            'functions' => [
                'json_encode', 'json_decode', 'serialize', 'unserialize',
            ],
        ],
        [
            'group' => '加密',
            'functions' => ['md5', 'sha1', 'hash', 'password_hash', 'password_verify', 'password_needs_rehash', 'hash_hmac'],
        ],
        [
            'group' => '日期/时间',
            'functions' => ['date', 'time', 'strtotime', 'microtime', 'gmdate', 'idate', 'getdate', 'date_default_timezone_set', 'date_default_timezone_get',
                'mktime', 'localtime', 'checkdate', GetISO8601Date::class, GetISO8601DateTime::class, GetISO8601DateTimeWithOffset::class, GetRFC1123DateTime::class,
            ],
        ],
        [
            'group' => '类型判断',
            'functions' => [
                'is_array', 'is_numeric', 'is_string', 'is_int', 'is_float', 'is_bool', 'is_object', 'is_null', 'gettype',
            ],
        ],
        [
            'group' => 'URL 操作',
            'functions' => [
                'parse_url', 'http_build_query', 'parse_str', 'urlencode', 'urldecode', 'rawurlencode', 'rawurldecode',
            ],
        ],
        [
            'group' => '逻辑',
            'functions' => [
                LogicalIfMethod::class,
            ],
        ],
        [
            // 隐藏，但是能使用
            'group' => 'hide',
            'functions' => [
                'var_dump', 'print_r', 'print', 'printf', 'json_last_error', 'json_last_error_msg',
            ],
        ],
    ],
    'php_sandbox_constants' => [
        'PHP_EOL', 'JSON_UNESCAPED_UNICODE', 'JSON_PRETTY_PRINT', 'JSON_ERROR_NONE',
    ],
];
