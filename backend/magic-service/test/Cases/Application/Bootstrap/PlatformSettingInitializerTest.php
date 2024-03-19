<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Bootstrap;

use App\Application\Bootstrap\Service\Initializer\PlatformSettingInitializer;
use App\Application\Kernel\DTO\PlatformSettings;
use App\Application\Kernel\Service\PlatformSettingsAppService;
use App\Infrastructure\Util\Context\CoContext;
use Mockery;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class PlatformSettingInitializerTest extends TestCase
{
    protected function tearDown(): void
    {
        CoContext::setLanguage('');
        Mockery::close();
        parent::tearDown();
    }

    public function testInitializeSkipsWhenAgentInfoIsMissing(): void
    {
        $platformSettingsAppService = Mockery::mock(PlatformSettingsAppService::class);
        $platformSettingsAppService->shouldReceive('get')->never();
        $platformSettingsAppService->shouldReceive('save')->never();

        $initializer = new PlatformSettingInitializer($platformSettingsAppService);
        $result = $initializer->initialize([], '', '');

        $this->assertTrue($result['success']);
        $this->assertTrue($result['is_skipped']);
        $this->assertTrue($result['is_idempotent_replay']);
        $this->assertSame('zh_CN', $result['language']);
    }

    public function testInitializeWritesLanguageSpecificFields(): void
    {
        CoContext::setLanguage('zh-CN');

        $platformSettingsAppService = Mockery::mock(PlatformSettingsAppService::class);
        $platformSettingsAppService->shouldReceive('get')
            ->once()
            ->andReturn(PlatformSettings::fromArray([
                'name_i18n' => ['en_US' => 'Old Name'],
                'agent_role_name_i18n' => ['en_US' => 'Old Name'],
                'agent_role_description_i18n' => ['en_US' => 'Old Desc'],
            ]));
        $platformSettingsAppService->shouldReceive('save')
            ->once()
            ->with(Mockery::on(function (PlatformSettings $settings): bool {
                $data = $settings->toArray();
                return ($data['name_i18n']['zh_CN'] ?? '') === '超级助手'
                    && ($data['agent_role_name_i18n']['zh_CN'] ?? '') === '超级助手'
                    && ($data['agent_role_description_i18n']['zh_CN'] ?? '') === '帮助你完成日常工作';
            }))
            ->andReturnUsing(static fn (PlatformSettings $settings): PlatformSettings => $settings);

        $initializer = new PlatformSettingInitializer($platformSettingsAppService);
        $result = $initializer->initialize(
            ['name' => '超级助手', 'description' => '帮助你完成日常工作'],
            '超级助手',
            '帮助你完成日常工作'
        );

        $this->assertTrue($result['success']);
        $this->assertFalse($result['is_skipped']);
        $this->assertFalse($result['is_idempotent_replay']);
        $this->assertSame('zh_CN', $result['language']);
    }

    public function testInitializeReturnsIdempotentReplayWhenNoChanges(): void
    {
        CoContext::setLanguage('en_US');

        $platformSettingsAppService = Mockery::mock(PlatformSettingsAppService::class);
        $platformSettingsAppService->shouldReceive('get')
            ->once()
            ->andReturn(PlatformSettings::fromArray([
                'name_i18n' => ['en_US' => 'Super Assistant'],
                'agent_role_name_i18n' => ['en_US' => 'Super Assistant'],
                'agent_role_description_i18n' => ['en_US' => 'Helps you finish daily work'],
            ]));
        $platformSettingsAppService->shouldReceive('save')->never();

        $initializer = new PlatformSettingInitializer($platformSettingsAppService);
        $result = $initializer->initialize(
            ['name' => 'Super Assistant', 'description' => 'Helps you finish daily work'],
            'Super Assistant',
            'Helps you finish daily work'
        );

        $this->assertTrue($result['success']);
        $this->assertFalse($result['is_skipped']);
        $this->assertTrue($result['is_idempotent_replay']);
        $this->assertSame('en_US', $result['language']);
    }

    public function testInitializeFallbacksUnsupportedLanguageToZhCn(): void
    {
        CoContext::setLanguage('fr_FR');

        $platformSettingsAppService = Mockery::mock(PlatformSettingsAppService::class);
        $platformSettingsAppService->shouldReceive('get')
            ->once()
            ->andReturn(new PlatformSettings());
        $platformSettingsAppService->shouldReceive('save')
            ->once()
            ->with(Mockery::on(function (PlatformSettings $settings): bool {
                $data = $settings->toArray();
                return ($data['name_i18n']['zh_CN'] ?? '') === '超级助手';
            }))
            ->andReturnUsing(static fn (PlatformSettings $settings): PlatformSettings => $settings);

        $initializer = new PlatformSettingInitializer($platformSettingsAppService);
        $result = $initializer->initialize(['name' => '超级助手'], '超级助手', '');

        $this->assertSame('zh_CN', $result['language']);
    }
}
