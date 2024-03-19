<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Flow\Entity\ValueObject\NodeParamsConfig;

use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\End\EndNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfigFactory;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Collector\ExecuteManager\FlowNodeCollector;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class NodeParamsConfigFactoryTest extends BaseTest
{
    public function testGenTemplate()
    {
        foreach (NodeType::cases() as $nodeType) {
            $node = Node::generateTemplate($nodeType);
            $this->assertEquals($nodeType->getCnName(), $node->getName());
            $this->assertInstanceOf(get_class(NodeParamsConfigFactory::make($node)), $node->getNodeParamsConfig());
        }
    }

    public function testGetLatest()
    {
        $node = Node::generateTemplate(NodeType::End, [], 'latest');
        $this->assertInstanceOf(EndNodeParamsConfig::class, $node->getNodeParamsConfig());
    }

    public function testGetVersionList()
    {
        $list = NodeParamsConfigFactory::getVersionList();
        var_dump($list);
        var_dump(FlowNodeCollector::get(1));
    }
}
