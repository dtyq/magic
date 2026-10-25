<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Mode\Assembler\DefaultModelPricePreviewAssembler;
use App\Application\Mode\DTO\DefaultModelPricePreviewDTO;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;

/** 编排默认文本模型售价快照，与前台用户模型解析链路隔离。 */
class DefaultModelPricePreviewService
{
    /** 复用后台 App 的默认模式快照，价格层只处理展示关系和售价。 */
    public function __construct(
        private readonly AdminModeAppService $modes,
        private readonly DefaultModelPricePreviewGraphBuilder $graphBuilder,
        private readonly DefaultModelPricePreviewAssembler $assembler,
        private readonly FileDomainService $files,
    ) {
    }

    /** 默认配置不存在时返回空态；配置或查询故障不得伪装成免费模型。 */
    public function get(MagicUserAuthorization $authorization, string $locale): DefaultModelPricePreviewDTO
    {
        $snapshot = $this->modes->getDefaultModeModelSnapshot($authorization, true);
        if ($snapshot['mode'] === null) {
            return new DefaultModelPricePreviewDTO();
        }
        $graph = $this->graphBuilder->build($snapshot);
        return $this->assembler->assemble($snapshot['mode'], $graph, $locale, $this->loadIcons($snapshot['mode'], $graph));
    }

    /** 批量解析分组与可达模型的对象路径，外部地址保持原样，不修改共享实体。 */
    private function loadIcons(ModeAggregate $mode, array $graph): array
    {
        $paths = [];
        foreach ($mode->getGroupAggregates() as $group) {
            $paths[] = $group->getGroup()->getIcon();
        }
        foreach ($graph['nodes'] as $node) {
            $paths[] = isset($node['model']) ? $node['model']->getIcon() : '';
        }
        $paths = array_values(array_unique(array_filter($paths, static fn (string $path): bool => $path !== '' && ! is_url($path))));
        if ($paths === []) {
            return [];
        }
        $icons = [];
        foreach ($this->files->getBatchLinksByOrgPaths($paths) as $path => $link) {
            $icons[$path] = $link->getUrl();
        }
        return $icons;
    }
}
