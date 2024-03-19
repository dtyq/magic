<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\Service;

use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\Flow\Entity\MagicFlowAIModelEntity;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Hyperf\Odin\Model\AbstractModel;
use Qbhy\HyperfAuth\Authenticatable;

class MagicFlowAIModelAppService extends AbstractFlowAppService
{
    /**
     * @return array{total: int, list: array<MagicFlowAIModelEntity>, icons: array<string, FileLink>}
     */
    public function getEnabled(Authenticatable $authorization, bool $withIcons = false): array
    {
        $dataIsolation = $this->createFlowDataIsolation($authorization);
        $mapper = di(ModelGatewayMapper::class);

        $iconPaths = [];
        $list = [];
        $models = $mapper->getChatModels($dataIsolation);
        foreach ($models as $odinModel) {
            /** @var AbstractModel $model */
            $model = $odinModel->getModel();
            if ($model->getModelOptions()->isEmbedding()) {
                continue;
            }

            $modelEntity = new MagicFlowAIModelEntity();
            $modelEntity->setName($odinModel->getAttributes()->getName());
            $modelEntity->setModelName($model->getModelName());
            $modelEntity->setLabel($odinModel->getAttributes()->getLabel() ?: $odinModel->getAttributes()->getName());
            $modelEntity->setIcon($odinModel->getAttributes()->getIcon());
            $modelEntity->setTags($odinModel->getAttributes()->getTags());
            $modelEntity->setDefaultConfigs(['temperature' => 0.5]);
            $modelEntity->setSupportMultiModal($model->getModelOptions()->isMultiModal());
            $list[] = $modelEntity;
            $iconPaths[] = $modelEntity->getIcon();
        }
        $icons = [];
        $withIcons && $icons = $this->getIconsWithSmartOrganization($iconPaths);

        // 按照 label 进行排序
        usort($list, function ($a, $b) {
            return strcmp($a->getLabel(), $b->getLabel());
        });

        return [
            'total' => count($list),
            'list' => $list,
            'icons' => $icons,
        ];
    }
}
