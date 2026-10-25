<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VolcengineArk\Assets;

use App\Infrastructure\ExternalAPI\VolcengineArk\Assets\VolcengineArkAssetProvider;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

/**
 * @internal
 */
final class VolcengineArkAssetProviderTest extends TestCase
{
    public function testComplianceFailureUsesProviderErrorCodeAndMessage(): void
    {
        $provider = (new ReflectionClass(VolcengineArkAssetProvider::class))->newInstanceWithoutConstructor();

        self::assertSame(
            'InvalidParameter.HeightTooSmall：Height must be between 300px and 6000px.',
            $provider->extractComplianceFailedReason(
                [
                    'ResponseMetadata' => [
                        'Error' => [
                            'Code' => 'InvalidParameter.HeightTooSmall',
                            'Message' => 'Height must be between 300px and 6000px.',
                        ],
                    ],
                ],
                'FAILED',
            ),
        );
    }

    /**
     * CreateAsset answers with the Id only. Mapping that to UNVERIFIED used to overwrite the PROCESSING
     * state written before the call, so the compliance API reported "not submitted" while the review was
     * still running.
     */
    public function testCreateAssetResponseWithoutStatusStaysProcessing(): void
    {
        $mapped = $this->map([
            'ResponseMetadata' => ['RequestId' => 'req-1', 'Action' => 'CreateAsset'],
            'Result' => ['Id' => 'asset-20261015152454-9g7h7'],
        ]);

        self::assertSame('asset-20261015152454-9g7h7', $mapped['provider_asset_id']);
        self::assertSame('PROCESSING', $mapped['provider_status']);
    }

    /**
     * @dataProvider providerStatusCases
     */
    public function testGetAssetStatusIsMappedFromTheProviderStatus(string $status, string $expected): void
    {
        $mapped = $this->map([
            'Result' => ['Id' => 'asset-1', 'Status' => $status],
        ]);

        self::assertSame($expected, $mapped['provider_status']);
    }

    public static function providerStatusCases(): array
    {
        return [
            'active' => ['Active', 'PASS'],
            'processing' => ['Processing', 'PROCESSING'],
            'failed' => ['Failed', 'FAILED'],
            'unknown state keeps waiting' => ['Pending', 'PROCESSING'],
        ];
    }

    /**
     * @param array<string, mixed> $response
     * @return array<string, mixed>
     */
    private function map(array $response): array
    {
        $provider = (new ReflectionClass(VolcengineArkAssetProvider::class))->newInstanceWithoutConstructor();
        return (new ReflectionMethod($provider, 'mapAssetResponse'))->invoke($provider, $response);
    }
}
