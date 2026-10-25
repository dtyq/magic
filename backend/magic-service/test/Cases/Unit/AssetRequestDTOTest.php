<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit;

use App\Application\Asset\Service\AdminAssetAppService;
use App\Application\Asset\Service\AssetAppService;
use App\Domain\Asset\Entity\ValueObject\AssetScope;
use App\Interfaces\Asset\DTO\Request\CreateAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\QueryAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\UpdateAssetRequestDTO;
use App\Interfaces\Asset\Facade\AdminAssetApi;
use App\Interfaces\Asset\Facade\AssetApi;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use ReflectionNamedType;

/**
 * @internal
 */
final class AssetRequestDTOTest extends TestCase
{
    public function testCreateDTOExposesRequestDataWithoutDomainConversion(): void
    {
        $dto = new CreateAssetRequestDTO([
            'asset_kind' => 'ASSET',
            'file_key' => 'images/example.png',
            'name' => '',
        ]);

        self::assertSame('ASSET', $dto->getAssetKind());
        self::assertSame('images/example.png', $dto->getFileKey());
        self::assertSame(['default' => ''], $dto->getNameI18n());
        self::assertSame('GENERAL', $dto->getAssetBusinessType());
        self::assertFalse(method_exists($dto, 'toEntity'));
        self::assertFalse(method_exists($dto, 'toProviderAssetEntity'));
    }

    public function testCreatePersonalAssetDTOMapsPlainTextFieldsToDefaultLocale(): void
    {
        $dto = new CreateAssetRequestDTO([
            'name' => '',
            'description' => null,
            'file_key' => 'images/example.png',
        ]);

        self::assertSame(['default' => ''], $dto->getNameI18n());
        self::assertSame(['default' => null], $dto->getDescriptionI18n());
    }

    public function testCreateAssetDTOAcceptsProjectFileSource(): void
    {
        $dto = new CreateAssetRequestDTO([
            'project_id' => '123',
            'project_file_path' => '/images/source.png',
        ]);

        self::assertSame(123, $dto->getProjectId());
        self::assertSame('/images/source.png', $dto->getProjectFilePath());
        self::assertNull($dto->getFileKey());
    }

    /**
     * 第三方凭证只由领域服务解析：请求里再出现这三个字段也一律被忽略，DTO 不再暴露。
     */
    public function testCreateDTODiscardsProviderCredentialsFromRequest(): void
    {
        $dto = new CreateAssetRequestDTO([
            'asset_kind' => 'ASSET',
            'file_key' => 'images/example.png',
            'provider_asset_id' => 'asset-1',
            'provider_group_id' => 'group-1',
            'project_name' => 'custom',
        ]);

        self::assertFalse(property_exists($dto, 'providerAssetId'));
        self::assertFalse(property_exists($dto, 'providerGroupId'));
        self::assertFalse(property_exists($dto, 'projectName'));
        self::assertFalse(method_exists($dto, 'getProviderAssetId'));
        self::assertFalse(method_exists($dto, 'getProviderGroupId'));
        self::assertFalse(method_exists($dto, 'getProjectName'));
        self::assertSame('images/example.png', $dto->getFileKey());
    }

    public function testQueryDTONormalizesPaginationAndFilters(): void
    {
        $dto = new QueryAssetRequestDTO([
            'page' => '2',
            'page_size' => '25',
            'parent_id' => '8',
            'status' => '0',
            'scope' => 'PUBLIC',
            'asset_business_type' => 'IMAGE',
        ]);

        self::assertSame(2, $dto->getPage());
        self::assertSame(25, $dto->getPageSize());
        self::assertSame(8, $dto->getParentId());
        self::assertSame(0, $dto->getStatus());
        self::assertSame(AssetScope::PUBLIC, $dto->getScope());
        self::assertSame('IMAGE', $dto->getAssetBusinessType());
    }

    /**
     * 不传 scope 时回落个人范围，避免把团队分享或公开资产混进个人列表。
     */
    public function testQueryDTODefaultsToPersonalScope(): void
    {
        self::assertSame(AssetScope::PERSONAL, (new QueryAssetRequestDTO([]))->getScope());
        self::assertSame(AssetScope::PERSONAL, (new QueryAssetRequestDTO(['scope' => '']))->getScope());
    }

    /**
     * 列表支持个人 / 团队分享 / 官方公开 / 全部四种范围；非法值被校验规则拒掉。
     */
    public function testQueryDTOExposesAllSupportedScopes(): void
    {
        $rules = (new ReflectionMethod(QueryAssetRequestDTO::class, 'getHyperfValidationRules'))->invoke(null);

        self::assertSame('nullable|string|in:ALL,PERSONAL,TEAM,PUBLIC', $rules['scope']);
        foreach (['ALL', 'PERSONAL', 'TEAM', 'PUBLIC'] as $scope) {
            self::assertSame($scope, (new QueryAssetRequestDTO(['scope' => $scope]))->getScope()->value);
        }
        // 非法值不会解析成别的范围，一律回落个人。
        self::assertSame(AssetScope::PERSONAL, (new QueryAssetRequestDTO(['scope' => 'UNKNOWN']))->getScope());
    }

    public function testUpdateDTOExposesOnlyProvidedRequestData(): void
    {
        $dto = new UpdateAssetRequestDTO([
            'name_i18n' => ['default' => 'new'],
            'status' => '0',
        ]);

        self::assertSame(['default' => 'new'], $dto->getNameI18n());
        self::assertSame(0, $dto->getStatus());
        self::assertFalse(method_exists($dto, 'applyTo'));
    }

    public function testAssetAPIsAndApplicationServicesUseDTOParameters(): void
    {
        self::assertNoRequestParameters(AssetApi::class, 'create');
        self::assertNoRequestParameters(AssetApi::class, 'list');
        self::assertNoRequestParameters(AdminAssetApi::class, 'create');
        self::assertNoRequestParameters(AdminAssetApi::class, 'queries');
        self::assertNoRequestParameters(AdminAssetApi::class, 'update');
        self::assertParameterType(AssetAppService::class, 'createPersonalAsset', CreateAssetRequestDTO::class);
        self::assertParameterType(AssetAppService::class, 'list', QueryAssetRequestDTO::class);
        self::assertParameterType(AdminAssetAppService::class, 'createPublicAsset', CreateAssetRequestDTO::class);
        self::assertParameterType(AdminAssetAppService::class, 'list', QueryAssetRequestDTO::class);
        self::assertParameterType(AdminAssetAppService::class, 'updatePublicAsset', UpdateAssetRequestDTO::class);
    }

    private static function assertParameterType(string $class, string $method, string $expectedType): void
    {
        $reflection = new ReflectionMethod($class, $method);
        $types = array_map(
            static fn ($parameter): ?string => $parameter->getType() instanceof ReflectionNamedType
                ? $parameter->getType()->getName()
                : null,
            $reflection->getParameters(),
        );
        self::assertContains($expectedType, $types, $class . '::' . $method);
    }

    private static function assertNoRequestParameters(string $class, string $method): void
    {
        $reflection = new ReflectionMethod($class, $method);
        foreach ($reflection->getParameters() as $parameter) {
            $type = $parameter->getType();
            self::assertFalse(
                $type instanceof ReflectionNamedType && str_ends_with($type->getName(), 'Request'),
                $class . '::' . $method,
            );
        }
    }
}
