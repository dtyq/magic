<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\OdinTools\MindSearch;

class MindSearchEventTableTool
{
    public static string $name = 'generateRelationEventsTable';

    public static string $description = '根据用户提问和搜索结果，生成相关事件列表';

    protected static array $parameters = [
        'type' => 'object',
        'properties' => [
            'relationEvents' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'properties' => [
                        'event_name' => [
                            'type' => 'string',
                            'description' => '关联事件名',
                        ],
                        'event_time' => [
                            'type' => 'string',
                            'description' => '关联事件发生时间',
                        ],
                        'event_description' => [
                            'type' => 'string',
                            'description' => '关联事件描述',
                        ],
                        'related_citations' => [
                            'type' => 'array',
                            'items' => ['type' => 'string'],
                            'description' => '关联事件引用的搜索结果',
                        ],
                    ],
                    'required' => ['event_name', 'event_time', 'event_description', 'related_citations'],
                ],
                'description' => '相关事件列表',
            ],
        ],
        'additionalProperties' => false,
        'required' => ['relationEvents'],
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
