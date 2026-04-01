<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\SuperAgentExtra;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfigCandidate;
use App\Domain\ModelGateway\Service\VideoGenerationConfigDomainService;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\DataIsolationTrait;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MemberRole;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Hyperf\Logger\LoggerFactory;
use Throwable;

class AbstractAppService extends AbstractKernelAppService
{
    use DataIsolationTrait;

    /**
     * 获取用户可访问的项目实体（默认大于可读角色）.
     *
     * @return ProjectEntity 项目实体
     */
    public function getAccessibleProject(int $projectId, string $userId, string $organizationCode, MemberRole $requiredRole = MemberRole::VIEWER): ProjectEntity
    {
        $projectDomainService = di(ProjectDomainService::class);
        $packageFilterService = di(PackageFilterInterface::class);
        $projectEntity = $projectDomainService->getProjectNotUserId($projectId);

        /*if ($projectEntity->getUserOrganizationCode() !== $organizationCode) {
            $logger->error('Project access denied', [
                'projectId' => $projectId,
                'userId' => $userId,
                'organizationCode' => $organizationCode,
                'projectUserOrganizationCode' => $projectEntity->getUserOrganizationCode(),
            ]);
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }*/

        // 如果是创建者，直接返回
        if ($projectEntity->getUserId() === $userId) {
            return $projectEntity;
        }

        // 判断是否开启共享项目
        if (! $projectEntity->getIsCollaborationEnabled()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        // 验证身份
        $magicUserAuthorization = new MagicUserAuthorization();
        $magicUserAuthorization->setOrganizationCode($organizationCode);
        $magicUserAuthorization->setId($userId);
        $this->validateRoleHigherOrEqual($magicUserAuthorization, $projectId, $requiredRole);

        // 判断是否付费套餐
        if (! $packageFilterService->isPaidSubscription($projectEntity->getUserOrganizationCode())) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }
        return $projectEntity;
    }

    /**
     * 获取用户可访问的项目实体（大于编辑角色）.
     */
    public function getAccessibleProjectWithEditor(int $projectId, string $userId, string $organizationCode): ProjectEntity
    {
        return $this->getAccessibleProject($projectId, $userId, $organizationCode, MemberRole::EDITOR);
    }

    /**
     * 获取用户可访问的项目实体（大于管理角色）.
     */
    public function getAccessibleProjectWithManager(int $projectId, string $userId, string $organizationCode): ProjectEntity
    {
        return $this->getAccessibleProject($projectId, $userId, $organizationCode, MemberRole::MANAGE);
    }

    /**
     * @return null|array<string, mixed>
     */
    protected function resolveVideoModelConfig(?array $videoModel): ?array
    {
        if ($videoModel === null) {
            return null;
        }

        $modelId = $this->extractVideoModelId($videoModel);
        if ($modelId === '') {
            return $videoModel;
        }

        if (is_array($videoModel['video_generation_config'] ?? null)) {
            $videoModel['model_id'] = $modelId;
            return $videoModel;
        }

        $videoGenerationConfig = $this->findVideoGenerationConfig($modelId);
        if ($videoGenerationConfig === null) {
            $videoModel['model_id'] = $modelId;
            return $videoModel;
        }

        return [
            'model_id' => $modelId,
            'video_generation_config' => $videoGenerationConfig,
        ];
    }

    /**
     * @param null|array<string, mixed> $extraData
     * @return null|array<string, mixed>
     */
    protected function appendVideoModelExtraData(?array $extraData, ?SuperAgentExtra $extra): ?array
    {
        if ($extra === null) {
            return $extraData;
        }

        $videoModel = $this->resolveVideoModelConfig($extra->getVideoModel());
        if ($videoModel === null) {
            return $extraData;
        }

        $extraData ??= [];
        if (isset($videoModel['model_id']) && is_string($videoModel['model_id']) && $videoModel['model_id'] !== '') {
            $extraData['video_model_id'] = $videoModel['model_id'];
        }
        if (is_array($videoModel['video_generation_config'] ?? null)) {
            $extraData['video_generation_config'] = $videoModel['video_generation_config'];
        }

        return $extraData === [] ? null : $extraData;
    }

    protected function appendVideoModelDynamicConfig(TaskContext $taskContext, ?SuperAgentExtra $extra): TaskContext
    {
        if ($extra === null) {
            return $taskContext;
        }

        $videoModel = $this->resolveVideoModelConfig($extra->getVideoModel());
        if ($videoModel === null) {
            return $taskContext;
        }

        $dynamicConfig = $taskContext->getDynamicConfig();
        $dynamicConfig['video_model'] = array_filter([
            'model_id' => $videoModel['model_id'] ?? null,
            'video_generation_config' => is_array($videoModel['video_generation_config'] ?? null)
                ? $videoModel['video_generation_config']
                : null,
        ], static fn (mixed $value): bool => $value !== null);

        return $taskContext->setDynamicConfig($dynamicConfig);
    }

    /**
     * 验证管理者或所有者权限.
     */
    protected function validateManageOrOwnerPermission(MagicUserAuthorization $magicUserAuthorization, int $projectId): void
    {
        $projectDomainService = di(ProjectDomainService::class);
        $projectEntity = $projectDomainService->getProjectNotUserId($projectId);
        // 判断是否开启共享项目
        if (! $projectEntity->getIsCollaborationEnabled()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        $this->validateRoleHigherOrEqual($magicUserAuthorization, $projectId, MemberRole::MANAGE);
    }

    /**
     * 验证可编辑者权限.
     */
    protected function validateEditorPermission(MagicUserAuthorization $magicUserAuthorization, int $projectId): void
    {
        $projectDomainService = di(ProjectDomainService::class);
        $projectEntity = $projectDomainService->getProjectNotUserId($projectId);
        // 判断是否开启共享项目
        if (! $projectEntity->getIsCollaborationEnabled()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        $this->validateRoleHigherOrEqual($magicUserAuthorization, $projectId, MemberRole::EDITOR);
    }

    /**
     * 验证可读权限.
     */
    protected function validateViewerPermission(MagicUserAuthorization $magicUserAuthorization, int $projectId): void
    {
        $projectDomainService = di(ProjectDomainService::class);
        $projectEntity = $projectDomainService->getProjectNotUserId($projectId);
        // 判断是否开启共享项目
        if (! $projectEntity->getIsCollaborationEnabled()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        $this->validateRoleHigherOrEqual($magicUserAuthorization, $projectId, MemberRole::VIEWER);
    }

    /**
     * 验证当前用户角色是否大于或等于指定角色.
     */
    protected function validateRoleHigherOrEqual(MagicUserAuthorization $magicUserAuthorization, int $projectId, MemberRole $requiredRole): void
    {
        $projectMemberService = di(ProjectMemberDomainService::class);
        $magicDepartmentUserDomainService = di(MagicDepartmentUserDomainService::class);
        $userId = $magicUserAuthorization->getId();

        $projectMemberEntity = $projectMemberService->getMemberByProjectAndUser($projectId, $userId);

        if ($projectMemberEntity && $projectMemberEntity->getRole()->isHigherOrEqualThan($requiredRole)) {
            return;
        }

        $dataIsolation = DataIsolation::create($magicUserAuthorization->getOrganizationCode(), $userId);
        $departmentIds = $magicDepartmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $userId, true);
        $projectMemberEntities = $projectMemberService->getMembersByProjectAndDepartmentIds($projectId, $departmentIds);

        foreach ($projectMemberEntities as $projectMemberEntity) {
            if ($projectMemberEntity->getRole()->isHigherOrEqualThan($requiredRole)) {
                return;
            }
        }
        ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
    }

    /**
     * @return null|array<string, mixed>
     */
    private function findVideoGenerationConfig(string $modelId): ?array
    {
        try {
            $candidates = $this->buildVideoGenerationConfigCandidates($modelId);
            if ($candidates === []) {
                return null;
            }

            $videoGenerationConfigDomainService = di(VideoGenerationConfigDomainService::class);
            $featuredConfigs = $videoGenerationConfigDomainService->resolveFeatured($candidates);
            return $featuredConfigs[$modelId]?->toArray() ?? null;
        } catch (Throwable $throwable) {
            di(LoggerFactory::class)->get(static::class)->warning('Failed to resolve video generation config, fallback to model_id only', [
                'model_id' => $modelId,
                'error' => $throwable->getMessage(),
                'exception' => $throwable::class,
            ]);
            return null;
        }
    }

    /**
     * @return list<VideoGenerationConfigCandidate>
     */
    private function buildVideoGenerationConfigCandidates(string $modelId): array
    {
        $providerDataIsolation = new ProviderDataIsolation(OfficialOrganizationUtil::getOfficialOrganizationCode());
        $providerModelDomainService = di(ProviderModelDomainService::class);
        $groupedModels = $providerModelDomainService->getModelsByModelIds($providerDataIsolation, [$modelId]);
        $providerModels = $groupedModels[$modelId] ?? [];
        if ($providerModels === []) {
            return [];
        }

        $providerConfigs = $this->getProviderConfigs($providerDataIsolation, $providerModels);
        $candidates = [];
        foreach ($providerModels as $providerModel) {
            if (! $this->isProviderModelAvailable($providerModel, $providerConfigs)) {
                continue;
            }

            $providerConfig = $providerConfigs[$providerModel->getServiceProviderConfigId()] ?? null;
            $providerCode = $providerConfig?->getProviderCode();
            if (! $providerCode instanceof ProviderCode) {
                continue;
            }

            $candidates[] = new VideoGenerationConfigCandidate(
                modelId: $modelId,
                modelVersion: $providerModel->getModelVersion(),
                providerCode: $providerCode,
            );
        }

        return $candidates;
    }

    /**
     * @param list<ProviderModelEntity> $providerModels
     * @return array<int, ProviderConfigEntity>
     */
    private function getProviderConfigs(ProviderDataIsolation $dataIsolation, array $providerModels): array
    {
        $configIds = [];
        foreach ($providerModels as $providerModel) {
            $configIds[] = $providerModel->getServiceProviderConfigId();
        }

        if ($configIds === []) {
            return [];
        }

        $providerConfigDomainService = di(ProviderConfigDomainService::class);
        return $providerConfigDomainService->getByIds(
            $dataIsolation,
            array_values(array_unique($configIds)),
        );
    }

    /**
     * @param array<int, ProviderConfigEntity> $providerConfigs
     */
    private function isProviderModelAvailable(ProviderModelEntity $providerModel, array $providerConfigs): bool
    {
        if ($providerModel->getStatus() !== Status::Enabled) {
            return false;
        }

        if ($providerModel->isDynamicModel()) {
            return true;
        }

        $providerStatus = $providerConfigs[$providerModel->getServiceProviderConfigId()]?->getStatus() ?? Status::Disabled;
        return $providerStatus === Status::Enabled;
    }

    private function extractVideoModelId(array $videoModel): string
    {
        $modelId = $videoModel['model_id'] ?? '';
        return is_string($modelId) ? trim($modelId) : '';
    }
}
