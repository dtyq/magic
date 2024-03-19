<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Collector\BuiltInToolSet;

use App\Infrastructure\Core\Collector\BuiltInToolSet\Annotation\BuiltInToolDefine;
use App\Infrastructure\Core\Collector\BuiltInToolSet\Annotation\BuiltInToolSetDefine;
use App\Infrastructure\Core\Contract\Flow\BuiltInToolInterface;
use App\Infrastructure\Core\Contract\Flow\BuiltInToolSetInterface;
use Hyperf\Di\Annotation\AnnotationCollector;

class BuiltInToolSetCollector
{
    /**
     * @var null|array<BuiltInToolSetInterface> list
     */
    protected static ?array $list = null;

    /**
     * @var null|array<string, BuiltInToolInterface> tools
     */
    protected static ?array $tools = [];

    public static function getToolByCode(string $code): ?BuiltInToolInterface
    {
        self::list();
        return self::$tools[$code] ?? null;
    }

    /**
     * 获取所有内置工具集 - 工具.
     * @return array<BuiltInToolSetInterface>
     */
    public static function list(): array
    {
        if (! is_null(self::$list)) {
            return self::$list;
        }
        $list = [];

        $builtInToolSetDefines = AnnotationCollector::getClassesByAnnotation(BuiltInToolSetDefine::class);
        $builtInToolDefines = AnnotationCollector::getClassesByAnnotation(BuiltInToolDefine::class);

        $toolsKeyBySetCode = [];
        /**
         * @var string $class
         * @var BuiltInToolDefine $builtInToolDefine
         */
        foreach ($builtInToolDefines as $class => $builtInToolDefine) {
            if (! class_exists($class) || ! $builtInToolDefine->isEnabled()) {
                continue;
            }
            $tool = di($class);
            if (! $tool instanceof BuiltInToolInterface) {
                continue;
            }
            $toolsKeyBySetCode[$tool->getToolSetCode()][$tool->getCode()] = $tool;
            self::$tools[$tool->getCode()] = $tool;
        }

        /**
         * @var string $class
         * @var BuiltInToolSetDefine $builtInToolSetDefine
         */
        foreach ($builtInToolSetDefines as $class => $builtInToolSetDefine) {
            if (! class_exists($class) || ! $builtInToolSetDefine->isEnabled()) {
                continue;
            }
            $toolSet = di($class);
            if (! $toolSet instanceof BuiltInToolSetInterface) {
                continue;
            }
            $tools = $toolsKeyBySetCode[$toolSet->getCode()] ?? [];
            $toolSet->setTools($tools);
            $list[] = $toolSet;
        }

        self::$list = $list;

        return self::$list;
    }

    public static function isBuiltInToolSet(string $code): bool
    {
        $list = self::list();
        foreach ($list as $toolSet) {
            if ($toolSet->getCode() === $code) {
                return true;
            }
        }
        return false;
    }
}
