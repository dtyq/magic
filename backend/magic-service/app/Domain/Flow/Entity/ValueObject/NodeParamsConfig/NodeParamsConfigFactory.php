<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig;

use App\Domain\Flow\Entity\ValueObject\Node;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\FlowNodeCollector;
use App\Infrastructure\Core\Contract\Flow\NodeParamsConfigInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class NodeParamsConfigFactory
{
    public static function make(Node $node): NodeParamsConfigInterface
    {
        $paramsConfigClass = $node->getNodeDefine()->getParamsConfig();
        if (! $paramsConfigClass) {
            ExceptionBuilder::throw(FlowErrorCode::BusinessException, 'flow.system.unknown_node_params_config', ['label' => "{$node->getName()} {$node->getNodeVersion()}"]);
        }
        return \Hyperf\Support\make($paramsConfigClass, ['node' => $node]);
    }

    public static function getVersionList(): array
    {
        $versionList = [];
        foreach (FlowNodeCollector::list() as $type => $flowNodeDefineVersions) {
            $versions = [];
            $name = '';
            foreach ($flowNodeDefineVersions as $flowNodeDefine) {
                $versions[] = $flowNodeDefine->getVersion();
                // 永远使用最新的版本名称
                $name = $flowNodeDefine->getName();
            }
            $versionList[] = [
                'node_type' => $type,
                'name' => $name,
                'versions' => $versions,
            ];
        }
        return $versionList;
    }
}
