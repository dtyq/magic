<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Assembler;

use Hyperf\Contract\TranslatorInterface;

/**
 * Provider Assembler抽象基类
 * 提取公共的转换逻辑，减少代码重复.
 */
abstract class AbstractProviderAssembler
{
    /**
     * 批量转换数组到实体.
     * @template T of object
     * @param class-string<T> $entityClass 实体类名
     * @param array $dataArray 数据数组
     * @return T[]
     */
    protected static function batchToEntities(string $entityClass, array $dataArray): array
    {
        if (empty($dataArray)) {
            return [];
        }

        $entities = [];
        foreach ($dataArray as $data) {
            $entities[] = static::createEntityFromArray($entityClass, (array) $data);
        }
        return $entities;
    }

    /**
     * 批量转换实体到数组.
     * @param array $entities 实体数组
     */
    protected static function batchToArrays(array $entities): array
    {
        if (empty($entities)) {
            return [];
        }

        $result = [];
        foreach ($entities as $entity) {
            $result[] = $entity->toArray();
        }
        return $result;
    }

    /**
     * 创建带国际化支持的实体.
     * @template T of object
     * @param class-string<T> $entityClass 实体类名
     * @param array $data 数据数组
     * @param bool $enableI18n 是否启用国际化
     * @return T
     */
    protected static function createEntityFromArray(string $entityClass, array $data, bool $enableI18n = true): object
    {
        $entity = new $entityClass($data);

        if ($enableI18n && method_exists($entity, 'i18n')) {
            $translator = di(TranslatorInterface::class);
            $entity->i18n($translator->getLocale());
        }

        return $entity;
    }

    /**
     * 空值检查助手方法.
     */
    protected static function isEmptyArray(?array $data): bool
    {
        return $data === null || empty($data);
    }
}
