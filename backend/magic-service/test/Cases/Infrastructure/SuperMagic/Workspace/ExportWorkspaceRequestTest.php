<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Infrastructure\SuperMagic\Workspace;

use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\Request\ExportWorkspaceRequest;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class ExportWorkspaceRequestTest extends TestCase
{
    public function testSerializesPublicUploadConfigOnlyWhenProvided(): void
    {
        $privateConfig = ['platform' => 'tos', 'dir' => 'private'];
        $publicConfig = ['platform' => 'tos', 'dir' => 'public'];

        $request = new ExportWorkspaceRequest(
            'slides_template_creator',
            'SLIDE-demo',
            $privateConfig,
            'templates/SLIDE-demo',
            'SLIDE-demo',
            'SLIDE-demo.zip',
            $publicConfig,
        );

        self::assertSame($privateConfig, $request->getUploadConfig());
        self::assertSame($publicConfig, $request->getPublicUploadConfig());
        self::assertSame($publicConfig, $request->toArray()['public_upload_config']);
    }

    public function testKeepsLegacyRequestPayloadUnchanged(): void
    {
        $request = new ExportWorkspaceRequest('skill_creator', 'SKILL-demo', ['dir' => 'skills']);

        self::assertArrayNotHasKey('public_upload_config', $request->toArray());
    }
}
