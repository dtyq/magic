<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Project\Service;

use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class ProjectAppServiceMicroAppModeContractTest extends TestCase
{
    public function testMicroAppCreationUsesDedicatedProjectMode(): void
    {
        $source = file_get_contents(
            dirname(__DIR__, 6) . '/app/Application/SuperMagic/Project/Service/ProjectAppService.php'
        );

        self::assertIsString($source);
        $methodStart = strpos($source, 'private function doCreateMicroAppProject(');
        self::assertNotFalse($methodStart);
        $methodEnd = strpos($source, "\n    /**", $methodStart);
        self::assertNotFalse($methodEnd);

        $methodSource = substr($source, $methodStart, $methodEnd - $methodStart);
        self::assertStringContainsString('ProjectMode::MICRO_APP->value', $methodSource);
        self::assertStringNotContainsString('ProjectMode::GENERAL->value', $methodSource);
    }
}
