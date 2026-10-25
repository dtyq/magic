<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit;

use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\ProviderAssetEntity;
use App\Domain\Asset\Entity\ValueObject\ProviderAssetStatus;
use App\Domain\Asset\Entity\ValueObject\ProviderReviewMode;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Asset\Assembler\AssetAssembler;
use App\Interfaces\Asset\DTO\Response\AssetDTO;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class AssetAssemblerTest extends TestCase
{
    public function testAssetResponseIsAFieldBasedDto(): void
    {
        $dto = AssetAssembler::createItem(new AssetEntity([
            'id' => 1,
            'asset_kind' => 'ASSET',
            'asset_business_type' => 'CHARACTER',
            'name_i18n' => ['default' => '角色'],
            'file_key' => 'character.png',
        ]));

        self::assertInstanceOf(AssetDTO::class, $dto);
        // 雪花 ID 以字符串返回，避免前端精度丢失。
        self::assertSame('1', $dto->getAssetId());
        self::assertSame('CHARACTER', $dto->getAssetBusinessType());
        self::assertSame('角色', $dto->getName());
    }

    public function testAssetListSerializesNestedDtos(): void
    {
        $response = AssetAssembler::createList(
            [new AssetEntity(['id' => 1, 'name_i18n' => ['default' => '角色']])],
            new Page(1, 10),
            1,
        )->toArray();

        self::assertSame('1', $response['list'][0]['asset_id']);
        self::assertSame('角色', $response['list'][0]['name']);
    }

    public function testComplianceFieldsComeFromProviderAsset(): void
    {
        // 第三方审核通过：状态透传，不暴露失败原因，结论来源是火山。
        $passed = AssetAssembler::createItem(
            new AssetEntity(['id' => 1, 'asset_kind' => 'ASSET']),
            null,
            false,
            new ProviderAssetEntity([
                'provider_status' => ProviderAssetStatus::PASS->value,
                'provider_failed_reason' => '不该展示',
            ]),
        );
        self::assertSame('PASS', $passed->getComplianceStatus());
        self::assertNull($passed->getComplianceFailedReason());
        self::assertSame('VOLCENGINE', $passed->getComplianceReviewMode());

        // 校验失败必须带上原因，前端要能直接展示。
        $failed = AssetAssembler::createItem(
            new AssetEntity(['id' => 2, 'asset_kind' => 'ASSET']),
            null,
            false,
            new ProviderAssetEntity([
                'provider_status' => ProviderAssetStatus::FAILED->value,
                'provider_failed_reason' => '内容涉嫌违规',
            ]),
        );
        self::assertSame('FAILED', $failed->getComplianceStatus());
        self::assertSame('内容涉嫌违规', $failed->getComplianceFailedReason());

        // 还在审核中：原样透出，前端不能当成通过。
        $processing = AssetAssembler::createItem(
            new AssetEntity(['id' => 3, 'asset_kind' => 'ASSET']),
            null,
            false,
            new ProviderAssetEntity(['provider_status' => ProviderAssetStatus::PROCESSING->value]),
        );
        self::assertSame('PROCESSING', $processing->getComplianceStatus());
        self::assertNull($processing->getComplianceFailedReason());

        // 没有第三方映射的素材（本地素材组）一律算「未校验」。
        $withoutProvider = AssetAssembler::createItem(new AssetEntity(['id' => 4, 'asset_kind' => 'GROUP']));
        self::assertSame('UNVERIFIED', $withoutProvider->getComplianceStatus());
        self::assertSame('VOLCENGINE', $withoutProvider->getComplianceReviewMode());

        // 无人像预检直接放行：状态是通过，但结论来源是 NO_PERSON，
        // 前端据此展示「未检测到真人」而不是「火山审核通过」。
        $noPerson = AssetAssembler::createItem(
            new AssetEntity(['id' => 5, 'asset_kind' => 'ASSET']),
            null,
            false,
            new ProviderAssetEntity([
                'provider_status' => ProviderAssetStatus::PASS->value,
                'provider_review_mode' => ProviderReviewMode::NO_PERSON->value,
            ]),
        );
        self::assertSame('PASS', $noPerson->getComplianceStatus());
        self::assertSame('NO_PERSON', $noPerson->getComplianceReviewMode());
        self::assertNull($noPerson->getComplianceFailedReason());
    }

    public function testComplianceFieldsAppearInSerializedList(): void
    {
        $response = AssetAssembler::createList(
            [new AssetEntity(['id' => 1, 'asset_kind' => 'ASSET'])],
            new Page(1, 10),
            1,
            [],
            false,
            ['1' => new ProviderAssetEntity([
                'provider_status' => ProviderAssetStatus::FAILED->value,
                'provider_failed_reason' => '内容涉嫌违规',
                'provider_review_mode' => ProviderReviewMode::REUSED->value,
            ])],
        )->toArray();

        self::assertSame('FAILED', $response['list'][0]['compliance_status']);
        self::assertSame('内容涉嫌违规', $response['list'][0]['compliance_failed_reason']);
        self::assertSame('REUSED', $response['list'][0]['compliance_review_mode']);
    }
}
