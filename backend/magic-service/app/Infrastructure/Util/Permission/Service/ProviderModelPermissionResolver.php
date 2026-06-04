<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Permission\Service;

use App\Application\Kernel\Contract\MagicPermissionInterface;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Permission\Annotation\CheckProviderModelPermission;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\HttpServer\Contract\RequestInterface;
use InvalidArgumentException;

class ProviderModelPermissionResolver
{
    public function __construct(
        private readonly MagicPermissionInterface $permission,
        private readonly ProviderConfigDomainService $providerConfigDomainService,
        private readonly ProviderModelDomainService $providerModelDomainService,
    ) {
    }

    public function resolvePermissionKey(
        string $scope,
        string $source,
        string $operation,
        MagicUserAuthorization $authorization,
        RequestInterface $request,
    ): string {
        $resource = match ($source) {
            CheckProviderModelPermission::SOURCE_REQUEST_CATEGORY => $this->resolveResourceByRequestCategory($scope, $request),
            CheckProviderModelPermission::SOURCE_MODEL_ID => $this->resolveResourceByModelId($scope, $authorization, $request),
            CheckProviderModelPermission::SOURCE_PROVIDER_CONFIG_ID => $this->resolveResourceByProviderConfigId($scope, $authorization, $request),
            CheckProviderModelPermission::SOURCE_PROVIDER_CONFIG_REQUEST => $this->resolveResourceByProviderConfigRequest($scope, $authorization, $request),
            default => throw new InvalidArgumentException('Unknown provider model permission source: ' . $source),
        };

        return $this->permission->buildPermission($resource, $operation);
    }

    private function resolveResourceByRequestCategory(string $scope, RequestInterface $request): string
    {
        $category = $this->resolveCategory($request->input('category', 'llm'));
        $modelType = $this->resolveModelType($request->input('model_type'));

        return $this->mapResourceByScopeAndModel($scope, $category, $modelType);
    }

    private function resolveResourceByModelId(
        string $scope,
        MagicUserAuthorization $authorization,
        RequestInterface $request,
    ): string {
        $modelId = $this->getRequiredValue(
            $request,
            ['modelId', 'model_id'],
            ['model_id', 'id'],
            '模型ID'
        );

        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );
        $modelEntity = $this->providerModelDomainService->getById($dataIsolation, $modelId);

        return $this->mapResourceByScopeAndModel($scope, $modelEntity->getCategory(), $modelEntity->getModelType());
    }

    private function resolveResourceByProviderConfigId(
        string $scope,
        MagicUserAuthorization $authorization,
        RequestInterface $request,
    ): string {
        $serviceProviderConfigId = $this->getRequiredValue(
            $request,
            ['serviceProviderConfigId', 'service_provider_config_id'],
            ['service_provider_config_id', 'id'],
            '服务商配置ID'
        );

        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );
        $providerConfigEntity = $this->providerConfigDomainService->getProviderConfig($dataIsolation, $serviceProviderConfigId);
        if ($providerConfigEntity === null) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => '服务商配置ID']);
        }

        $providerEntity = $this->providerConfigDomainService->getProviderById($dataIsolation, $providerConfigEntity->getServiceProviderId());
        if ($providerEntity === null) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => '服务商']);
        }

        return $this->mapResourceByScopeAndModel($scope, $providerEntity->getCategory(), null);
    }

    private function resolveResourceByProviderConfigRequest(
        string $scope,
        MagicUserAuthorization $authorization,
        RequestInterface $request,
    ): string {
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );

        $configId = $this->firstNonEmpty([
            $request->input('id'),
            $request->route('id'),
        ]);

        if ($configId !== null) {
            $providerConfigEntity = $this->providerConfigDomainService->getConfigByIdWithoutOrganizationFilter((int) $configId);
            if ($providerConfigEntity === null) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => '服务商配置ID']);
            }

            $providerEntity = $this->providerConfigDomainService->getProviderById($dataIsolation, $providerConfigEntity->getServiceProviderId());
            if ($providerEntity === null) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => '服务商']);
            }

            return $this->mapResourceByScopeAndModel($scope, $providerEntity->getCategory(), null);
        }

        $serviceProviderId = $this->getRequiredValue(
            $request,
            ['serviceProviderId', 'service_provider_id'],
            ['service_provider_id'],
            '服务商ID'
        );

        $providerEntity = $this->providerConfigDomainService->getProviderById($dataIsolation, (int) $serviceProviderId);
        if ($providerEntity === null) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => '服务商ID']);
        }

        return $this->mapResourceByScopeAndModel($scope, $providerEntity->getCategory(), null);
    }

    private function mapResourceByScopeAndModel(string $scope, ?Category $category, ?ModelType $modelType): string
    {
        $isImage = $this->isImageModel($category, $modelType);
        $isVideo = $this->isVideoModel($category, $modelType);

        return match ($scope) {
            CheckProviderModelPermission::SCOPE_PLATFORM => match (true) {
                $isImage => MagicResourceEnum::PLATFORM_MODEL_IMAGE->value,
                $isVideo => MagicResourceEnum::PLATFORM_MODEL_VIDEO->value,
                default => MagicResourceEnum::PLATFORM_MODEL_TEXT->value,
            },
            CheckProviderModelPermission::SCOPE_WORKSPACE => $isImage
                ? MagicResourceEnum::WORKSPACE_MODEL_IMAGE->value
                : MagicResourceEnum::WORKSPACE_MODEL_TEXT->value,
            default => throw new InvalidArgumentException('Unknown provider model permission scope: ' . $scope),
        };
    }

    private function isImageModel(?Category $category, ?ModelType $modelType): bool
    {
        if ($modelType?->isImageGeneration()) {
            return true;
        }

        return $category?->isVlm() ?? false;
    }

    private function isVideoModel(?Category $category, ?ModelType $modelType): bool
    {
        if ($modelType?->isVideoGeneration()) {
            return true;
        }

        return $category === Category::VGM || $category === Category::VIDEO;
    }

    private function resolveCategory(mixed $rawCategory): ?Category
    {
        if (! is_string($rawCategory) || $rawCategory === '') {
            return null;
        }

        return Category::tryFrom($rawCategory);
    }

    private function resolveModelType(mixed $rawModelType): ?ModelType
    {
        if ($rawModelType === null || $rawModelType === '') {
            return null;
        }

        if (is_int($rawModelType) || (is_string($rawModelType) && is_numeric($rawModelType))) {
            return ModelType::tryFrom((int) $rawModelType);
        }

        return null;
    }

    /**
     * @param string[] $routeKeys
     * @param string[] $inputKeys
     */
    private function getRequiredValue(RequestInterface $request, array $routeKeys, array $inputKeys, string $label): string
    {
        $value = $this->firstNonEmpty([
            ...array_map(static fn (string $key) => $request->route($key), $routeKeys),
            ...array_map(static fn (string $key) => $request->input($key), $inputKeys),
        ]);

        if ($value === null) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.empty', ['label' => $label]);
        }

        return $value;
    }

    /**
     * @param array<int, mixed> $values
     */
    private function firstNonEmpty(array $values): ?string
    {
        foreach ($values as $value) {
            if ($value === null || $value === '') {
                continue;
            }

            return (string) $value;
        }

        return null;
    }
}
