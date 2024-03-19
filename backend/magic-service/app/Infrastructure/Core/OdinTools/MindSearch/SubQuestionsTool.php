<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\OdinTools\MindSearch;

class SubQuestionsTool
{
    public static string $name = 'batchSubQuestionsSearch';

    public static string $description = '根据原始问题，拆分多个子问题，用于批量互联网搜索';

    protected static array $parameters = [
        'type' => 'object',
        'properties' => [
            'subQuestions' => [
                'type' => 'array',
                'items' => ['type' => 'string'],
                'description' => '根据原始问题拆分出来的一个子问题',
            ],
        ],
        'additionalProperties' => false,
        'required' => ['subQuestions'],
    ];

    public function toArray(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => self::$name,
                'description' => self::$description,
                'parameters' => self::$parameters,
            ],
        ];
    }
}
