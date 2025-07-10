<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 删除数据类型枚举
 * 用于标识被删除的数据类型，以便查询相关的运行中任务
 */
enum DeleteDataType: string
{
    /**
     * 工作区.
     */
    case WORKSPACE = 'workspace';

    /**
     * 项目.
     */
    case PROJECT = 'project';

    /**
     * 话题.
     */
    case TOPIC = 'topic';

    /**
     * 获取类型描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::WORKSPACE => '工作区',
            self::PROJECT => '项目',
            self::TOPIC => '话题',
        };
    }

    /**
     * 获取所有类型列表.
     *
     * @return array<string, string> 类型值与描述的映射
     */
    public static function getList(): array
    {
        return [
            self::WORKSPACE->value => self::WORKSPACE->getDescription(),
            self::PROJECT->value => self::PROJECT->getDescription(),
            self::TOPIC->value => self::TOPIC->getDescription(),
        ];
    }
}
