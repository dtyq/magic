<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Factory;

use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\ValueObject\ConstValue;
use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Domain\Flow\Entity\ValueObject\Type;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowModel;
use DateTime;
use Dtyq\FlowExprEngine\ComponentFactory;

class MagicFlowFactory
{
    public static function modelToEntity(MagicFlowModel $magicFlowModel): MagicFlowEntity
    {
        return self::arrayToEntity($magicFlowModel->toArray(), 'v0');
    }

    public static function arrayToEntity(array $magicFlowArray, string $defaultNodeVersion = ''): MagicFlowEntity
    {
        $magicFlowEntity = new MagicFlowEntity();

        $magicFlowEntity->setId($magicFlowArray['id']);
        $magicFlowEntity->setCode($magicFlowArray['code']);
        $magicFlowEntity->setVersionCode($magicFlowArray['version_code']);
        $magicFlowEntity->setName($magicFlowArray['name']);
        $magicFlowEntity->setDescription($magicFlowArray['description']);
        $magicFlowEntity->setIcon($magicFlowArray['icon'] ?? '');
        $magicFlowEntity->setToolSetId($magicFlowArray['tool_set_id'] ?? ConstValue::TOOL_SET_DEFAULT_CODE);
        $magicFlowEntity->setType(Type::from($magicFlowArray['type']));
        $magicFlowEntity->setEnabled($magicFlowArray['enabled']);
        $magicFlowEntity->setVersionCode($magicFlowArray['version_code']);
        $magicFlowEntity->setOrganizationCode($magicFlowArray['organization_code']);
        $magicFlowEntity->setCreator($magicFlowArray['created_uid'] ?? $magicFlowArray['creator'] ?? '');
        $magicFlowEntity->setCreatedAt(new DateTime($magicFlowArray['created_at']));
        $magicFlowEntity->setModifier($magicFlowArray['updated_uid'] ?? $magicFlowArray['modifier'] ?? '');
        $magicFlowEntity->setUpdatedAt(new DateTime($magicFlowArray['updated_at']));
        $magicFlowEntity->setEdges($magicFlowArray['edges'] ?? []);
        if (! empty($magicFlowArray['global_variable'])) {
            $magicFlowEntity->setGlobalVariable(ComponentFactory::fastCreate($magicFlowArray['global_variable']));
        }
        $nodes = [];
        foreach ($magicFlowArray['nodes'] ?? [] as $nodeArr) {
            if (! isset($nodeArr['node_type'])) {
                continue;
            }
            if (! isset($nodeArr['node_version']) || $nodeArr['node_version'] === '') {
                $nodeArr['node_version'] = $defaultNodeVersion;
            }
            $node = new Node($nodeArr['node_type'], $nodeArr['node_version']);
            $node->setNodeId($nodeArr['node_id']);
            $node->setDebug($nodeArr['debug'] ?? false);
            $node->setName($nodeArr['name']);
            $node->setDescription($nodeArr['description']);
            $node->setMeta($nodeArr['meta']);
            $node->setParams($nodeArr['params']);
            $node->setNextNodes($nodeArr['next_nodes']);
            $input = new NodeInput();
            $output = new NodeOutput();
            $input->setForm(ComponentFactory::fastCreate($nodeArr['input']['form'] ?? [], lazy: true));
            $output->setForm(ComponentFactory::fastCreate($nodeArr['output']['form'] ?? [], lazy: true));
            $node->setInput($input);
            $node->setOutput($output);
            $systemOutput = new NodeOutput();
            $systemOutput->setForm(ComponentFactory::fastCreate($nodeArr['system_output']['form'] ?? [], lazy: true));
            $node->setSystemOutput($systemOutput);
            // 这里除了检测还会初始化数据，所以不要删除
            $node->validate();

            $nodes[] = $node;
        }

        $magicFlowEntity->setNodes($nodes);
        $magicFlowEntity->collectNodes();

        return $magicFlowEntity;
    }
}
