<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Assembler\Node;

use App\Domain\Flow\Entity\ValueObject\Node;
use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;
use App\Interfaces\Flow\DTO\Node\NodeDTO;
use App\Interfaces\Flow\DTO\Node\NodeInputDTO;
use App\Interfaces\Flow\DTO\Node\NodeOutputDTO;

class MagicFlowNodeAssembler
{
    public static function createNodeDTO(Node $node): NodeDTO
    {
        return new NodeDTO($node->toArray());
    }

    public static function createNodeDTOByMixed(mixed $data): ?NodeDTO
    {
        if ($data instanceof NodeDTO) {
            return $data;
        }
        if (is_array($data)) {
            $nodeDTO = new NodeDTO($data);
            if ($nodeDTO->getNodeType()) {
                return $nodeDTO;
            }
        }
        return null;
    }

    public static function createNodeInputDTOByMixed(mixed $data): ?NodeInputDTO
    {
        if ($data instanceof NodeInputDTO) {
            return $data;
        }
        if (is_array($data)) {
            return new NodeInputDTO($data);
        }
        return null;
    }

    public static function createNodeOutputDTOByMixed(mixed $data): ?NodeOutputDTO
    {
        if ($data instanceof NodeOutputDTO) {
            return $data;
        }
        if (is_array($data)) {
            return new NodeOutputDTO($data);
        }
        return null;
    }

    public static function createNodeDO(NodeDTO $nodeDTO): Node
    {
        $node = new Node($nodeDTO->getNodeType(), $nodeDTO->getNodeVersion());
        $node->setNodeId($nodeDTO->getNodeId());
        $node->setDebug($nodeDTO->getDebug());
        $node->setName($nodeDTO->getName());
        $node->setDescription($nodeDTO->getDescription());
        $node->setMeta($nodeDTO->getMeta());
        $node->setParams($nodeDTO->getParams());
        $node->setNextNodes($nodeDTO->getNextNodes());

        if ($nodeDTO->getInput()) {
            $input = new NodeInput();
            $input->setForm($nodeDTO->getInput()->getForm());
            $input->setWidget($nodeDTO->getInput()->getWidget());
            $node->setInput($input);
        }
        if ($nodeDTO->getOutput()) {
            $output = new NodeOutput();
            $output->setForm($nodeDTO->getOutput()->getForm());
            $output->setWidget($nodeDTO->getOutput()->getWidget());
            $node->setOutput($output);
        }
        if ($nodeDTO->getSystemOutput()) {
            $systemOutput = new NodeOutput();
            $systemOutput->setForm($nodeDTO->getSystemOutput()->getForm());
            $systemOutput->setWidget($nodeDTO->getSystemOutput()->getWidget());
            $node->setSystemOutput($systemOutput);
        }

        return $node;
    }
}
