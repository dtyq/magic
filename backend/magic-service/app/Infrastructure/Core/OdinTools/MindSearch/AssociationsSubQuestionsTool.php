<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\OdinTools\MindSearch;

/**
 * 批量生成关联问题的子问题，然后批量互联网搜索.
 */
class AssociationsSubQuestionsTool
{
    public static string $name = 'associationsSubQuestionsSearch';

    public static string $description = '将每个关联问题拆分为多个子问题，然后批量互联网搜索';

    protected static array $parameters = [
        'type' => 'object',
        'properties' => [
            'association' => [
                'type' => 'string',
                'description' => '关联问题',
            ],
            'subQuestions' => [
                'type' => 'array',
                'items' => [
                    'type' => 'string',
                ],
                'description' => '关联问题的多个子问题',
            ],
        ],
        'required' => ['association', 'subQuestions'],
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
