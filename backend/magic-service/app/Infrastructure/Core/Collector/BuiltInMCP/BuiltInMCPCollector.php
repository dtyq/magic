<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Collector\BuiltInMCP;

use App\Infrastructure\Core\Collector\BuiltInMCP\Annotation\BuiltInMCPServerDefine;
use App\Infrastructure\Core\Contract\MCP\BuiltInMCPServerInterface;
use Hyperf\Di\Annotation\AnnotationCollector;

class BuiltInMCPCollector
{
    /**
     * @var null|array<string> list of server classes
     */
    protected static ?array $list = null;

    /**
     * @var null|array<string, string> servers indexed by server code, value is class name
     */
    protected static ?array $servers = null;

    /**
     * Get MCP server class by code.
     */
    public static function getServerClassByCode(string $mcpServerCode): ?string
    {
        self::list();

        // Try to find by exact match first
        if (isset(self::$servers[$mcpServerCode])) {
            return self::$servers[$mcpServerCode];
        }

        // Try to find by prefix match (for compatibility with existing match method)
        foreach (self::$list as $serverClass) {
            if ($serverClass::match($mcpServerCode)) {
                return $serverClass;
            }
        }

        return null;
    }

    /**
     * Get all built-in MCP server classes.
     * @return array<string>
     */
    public static function list(): array
    {
        if (! is_null(self::$list)) {
            return self::$list;
        }

        $list = [];
        $servers = [];

        $builtInMCPDefines = AnnotationCollector::getClassesByAnnotation(BuiltInMCPServerDefine::class);

        /**
         * @var string $class
         * @var BuiltInMCPServerDefine $builtInMCPDefine
         */
        foreach ($builtInMCPDefines as $class => $builtInMCPDefine) {
            if (! class_exists($class) || ! $builtInMCPDefine->isEnabled()) {
                continue;
            }

            // Check if class implements BuiltInMCPServerInterface
            if (! is_subclass_of($class, BuiltInMCPServerInterface::class)) {
                continue;
            }

            // Get server code from annotation
            $serverCode = $builtInMCPDefine->getServerCode();

            $list[] = $class;
            $servers[$serverCode] = $class;
        }

        // Sort by annotation priority value
        usort($list, function (string $classA, string $classB) {
            $aDefine = AnnotationCollector::getClassAnnotation($classA, BuiltInMCPServerDefine::class);
            $bDefine = AnnotationCollector::getClassAnnotation($classB, BuiltInMCPServerDefine::class);

            $aPriority = $aDefine ? $aDefine->getPriority() : 99;
            $bPriority = $bDefine ? $bDefine->getPriority() : 99;

            return $aPriority <=> $bPriority;
        });

        self::$list = $list;
        self::$servers = $servers;

        return self::$list;
    }
}
