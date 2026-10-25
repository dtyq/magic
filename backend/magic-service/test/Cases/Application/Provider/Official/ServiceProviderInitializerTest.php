<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Provider\Official;

use App\Application\Provider\Initializer\ServiceProviderInitializer;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use Hyperf\Contract\ConfigInterface;
use Hyperf\DbConnection\Db;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ServiceProviderInitializerTest extends TestCase
{
    private const array INITIALIZED_PROVIDERS = [
        [ProviderCode::Official, 'llm'],
        [ProviderCode::Tencent, 'llm'],
        [ProviderCode::Baidu, 'llm'],
        [ProviderCode::SCNet, 'llm'],
        [ProviderCode::Moonshot, 'llm'],
        [ProviderCode::BigModel, 'llm'],
        [ProviderCode::MiniMax, 'llm'],
        [ProviderCode::SiliconFlow, 'llm'],
        [ProviderCode::Official, 'vlm'],
        [ProviderCode::Keling, 'vgm'],
        [ProviderCode::VolcengineArk, 'vgm'],
        [ProviderCode::MiniMax, 'vgm'],
        [ProviderCode::DashScope, 'vgm'],
        [ProviderCode::Gemini, 'vgm'],
    ];

    private mixed $originalOfficialOrganization;

    protected function setUp(): void
    {
        parent::setUp();

        $config = di(ConfigInterface::class);
        $this->originalOfficialOrganization = $config->get('service_provider.office_organization');
        $config->set('service_provider.office_organization', 'service-provider-initializer-test-org');
        Db::beginTransaction();
    }

    protected function tearDown(): void
    {
        Db::rollBack();
        di(ConfigInterface::class)->set('service_provider.office_organization', $this->originalOfficialOrganization);

        parent::tearDown();
    }

    public function testInitCreatesMissingProvidersWithoutChangingProviderConfigs(): void
    {
        foreach (self::INITIALIZED_PROVIDERS as [$providerCode, $category]) {
            Db::table('service_provider')
                ->where('provider_code', $providerCode->value)
                ->where('category', $category)
                ->whereNull('deleted_at')
                ->delete();
        }
        $providerConfigsBefore = $this->snapshotProviderConfigs();

        $result = ServiceProviderInitializer::init();

        self::assertTrue($result['success']);
        foreach (self::INITIALIZED_PROVIDERS as [$providerCode, $category]) {
            self::assertSame(1, Db::table('service_provider')
                ->where('provider_code', $providerCode->value)
                ->where('category', $category)
                ->whereNull('deleted_at')
                ->count());
        }
        $this->assertOfficialProvider('llm', '由 Magic 通过官方部署的 API 来实现 AI 模型的调用，可直接购买 Tokens 使用海量的大模型。');
        $this->assertOfficialProvider('vlm', '由 Magic 通过官方部署的 API 来实现多种热门的文生图、图生图等模型的调用，可直接购买 Tokens 使用海量的大模型。');
        self::assertSame($providerConfigsBefore, $this->snapshotProviderConfigs());
    }

    public function testInitIsIdempotentAndReturnsWellFormedMessage(): void
    {
        ServiceProviderInitializer::init();

        $result = ServiceProviderInitializer::init();

        self::assertTrue($result['success']);
        self::assertSame(0, $result['count']);
        self::assertSame(
            'Successfully initialized 0 items (providers: 0). Official video providers must be initialized manually via /api/v1/bootstrap/video-providers.',
            $result['message']
        );
        foreach (self::INITIALIZED_PROVIDERS as [$providerCode, $category]) {
            self::assertSame(1, Db::table('service_provider')
                ->where('provider_code', $providerCode->value)
                ->where('category', $category)
                ->whereNull('deleted_at')
                ->count());
        }
    }

    private function assertOfficialProvider(string $category, string $description): void
    {
        $provider = Db::table('service_provider')
            ->where('provider_code', ProviderCode::Official->value)
            ->where('category', $category)
            ->whereNull('deleted_at')
            ->first();

        self::assertNotNull($provider);
        self::assertSame('Magic', $provider['name']);
        self::assertSame($description, $provider['description']);
        self::assertSame('MAGIC/588417216353927169/default/superMagic.png', $provider['icon']);
        self::assertSame(1, $provider['provider_type']);
        self::assertSame(1, $provider['status']);
        self::assertSame(0, $provider['is_models_enable']);
        self::assertSame(999, $provider['sort_order']);
        self::assertSame('', $provider['remark']);

        $translation = json_decode($provider['translate'], true, 512, JSON_THROW_ON_ERROR);
        self::assertSame('Magic', $translation['name']['en_US']);
        self::assertSame('Magic', $translation['name']['zh_CN']);
        self::assertSame($description, $translation['description']['zh_CN']);
        self::assertNotEmpty($translation['description']['en_US']);
    }

    private function snapshotProviderConfigs(): string
    {
        return json_encode(
            Db::table('service_provider_configs')->orderBy('id')->get()->all(),
            JSON_THROW_ON_ERROR
        );
    }
}
