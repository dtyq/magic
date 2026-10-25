<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Workspace;

use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Workspace\Entity\ValueObject\WorkspaceType;
use PHPUnit\Framework\TestCase;

/**
 * AI canvas relies on two contracts:
 * | Contract                         | Why                                                        |
 * | workspace type is internal       | GET /workspaces/app/ai-canvas may get-or-create it         |
 * | project mode is not query-hidden | the canvas home lists by workspace; recent/search show it  |
 *
 * @internal
 */
final class AiCanvasTypeContractTest extends TestCase
{
    public function testAiCanvasWorkspaceTypeIsInternal(): void
    {
        self::assertSame('ai-canvas', WorkspaceType::AiCanvas->value);
        self::assertTrue(WorkspaceType::isValid(WorkspaceType::AiCanvas->value));
        self::assertNotContains(WorkspaceType::AiCanvas->value, WorkspaceType::getPublicTypes());
    }

    public function testAiCanvasProjectModeStaysVisibleInProjectQueries(): void
    {
        self::assertSame('ai-canvas', ProjectMode::AI_CANVAS->value);
        self::assertContains(ProjectMode::AI_CANVAS->value, ProjectMode::getAllModes());
        self::assertNotContains(ProjectMode::AI_CANVAS->value, ProjectMode::getQueryFilterModes());
        self::assertNotContains(ProjectMode::AI_CANVAS->value, ProjectMode::getRecentListSpecialModes());
        self::assertSame('AI 画布模式', ProjectMode::AI_CANVAS->getDescription());
    }
}
