<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Collector\ExecuteManager;

use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\AgentPluginDefine;
use Hyperf\Di\Annotation\AnnotationCollector;

class AgentPluginCollector
{
    /**
     * @var null|array<AgentPluginDefine>
     */
    private static ?array $agentPluginDefines = null;

    public static function list(): array
    {
        if (! is_null(self::$agentPluginDefines)) {
            return self::$agentPluginDefines;
        }
        $agentPluginDefines = AnnotationCollector::getClassesByAnnotation(AgentPluginDefine::class);
        $agentPlugins = [];
        /**
         * @var AgentPluginDefine $agentPluginDefine
         */
        foreach ($agentPluginDefines as $agentPluginDefine) {
            if (! $agentPluginDefine->isEnabled()) {
                continue;
            }
            $agentPlugins[$agentPluginDefine->getCode()][$agentPluginDefine->getPriority()] = $agentPluginDefine;
        }
        // 获取最大的
        foreach ($agentPlugins as $code => $plugins) {
            krsort($plugins);
            $agentPlugins[$code] = array_shift($plugins);
        }

        self::$agentPluginDefines = $agentPlugins;
        return $agentPlugins;
    }
}
