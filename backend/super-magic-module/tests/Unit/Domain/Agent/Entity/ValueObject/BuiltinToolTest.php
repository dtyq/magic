<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Tests\Unit\Domain\Agent\Entity\ValueObject;

use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\BuiltinTool;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\BuiltinToolCategory;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentType;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class BuiltinToolTest extends TestCase
{
    public function testSearchKnowledgeIsBuiltinButNotRequired(): void
    {
        $tool = BuiltinTool::SearchKnowledge;
        $requiredToolCodes = array_map(
            static fn (BuiltinTool $builtinTool): string => $builtinTool->value,
            BuiltinTool::getRequiredTools()
        );

        self::assertSame('search_knowledge', $tool->value);
        self::assertTrue(BuiltinTool::isValidTool($tool->value));
        self::assertSame(BuiltinToolCategory::SearchExtraction, $tool->getToolCategory());
        self::assertNotContains($tool->value, $requiredToolCodes);
    }

    public function testSearchKnowledgeIsDefaultOnlyForCustomAgent(): void
    {
        $customDefaultToolCodes = array_map(
            static fn (BuiltinTool $builtinTool): string => $builtinTool->value,
            BuiltinTool::getDefaultToolsForAgentType(SuperMagicAgentType::Custom)
        );
        $builtinDefaultToolCodes = array_map(
            static fn (BuiltinTool $builtinTool): string => $builtinTool->value,
            BuiltinTool::getDefaultToolsForAgentType(SuperMagicAgentType::Built_In)
        );

        self::assertContains(BuiltinTool::SearchKnowledge->value, $customDefaultToolCodes);
        self::assertNotContains(BuiltinTool::SearchKnowledge->value, $builtinDefaultToolCodes);
        self::assertSame(
            array_search(BuiltinTool::WebSearch->value, $customDefaultToolCodes, true) + 1,
            array_search(BuiltinTool::SearchKnowledge->value, $customDefaultToolCodes, true)
        );
    }
}
