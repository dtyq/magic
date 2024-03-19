<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript\NodeVisitor;

use Twig\Environment;
use Twig\Node\Expression\NameExpression;
use Twig\Node\Node;
use Twig\NodeVisitor\NodeVisitorInterface;

class PlaceholderNodeVisitor implements NodeVisitorInterface
{
    private $placeholders = [];

    public function enterNode(Node $node, Environment $env): Node
    {
        if ($node instanceof NameExpression) {
            $name = $node->getAttribute('name');
            ! isset($this->placeholders[$name]) && $this->placeholders[$name] = $name;
        }

        return $node;
    }

    public function leaveNode(Node $node, Environment $env): ?Node
    {
        return $node;
    }

    public function getPriority()
    {
        return 0;
    }

    public function getPlaceholders(): array
    {
        return $this->placeholders;
    }
}
