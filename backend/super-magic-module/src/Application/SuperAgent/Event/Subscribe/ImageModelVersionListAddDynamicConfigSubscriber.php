<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\DynamicConfig\DynamicConfigManager;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskBeforeEvent;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Container\ContainerInterface;

#[Listener]
class ImageModelVersionListAddDynamicConfigSubscriber implements ListenerInterface
{
    private DynamicConfigManager $dynamicConfigManager;

    public function __construct(ContainerInterface $container)
    {
        $this->dynamicConfigManager = $container->get(DynamicConfigManager::class);
    }

    public function listen(): array
    {
        return [
            RunTaskBeforeEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof RunTaskBeforeEvent) {
            return;
        }
        if (! $event->getTaskId()) {
            return;
        }

        // 获取当前组织可用的所有生图模型，给出一份 model_id => model_version 对照表
        $dataIsolation = ModelGatewayDataIsolation::createByOrganizationCodeWithoutSubscription($event->getOrganizationCode());
        $imageModels = di(ModelGatewayMapper::class)->getImageModels($dataIsolation);

        $list = [];
        foreach ($imageModels as $imageModel) {
            $list[$imageModel->getKey()] = $imageModel->getAttributes()->getName();
        }

        $this->dynamicConfigManager->addByTaskId($event->getTaskId(), 'image_model_versions', $list);
    }
}
