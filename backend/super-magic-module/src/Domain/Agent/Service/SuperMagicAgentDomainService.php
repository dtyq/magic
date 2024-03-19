<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use DateTime;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentMarketEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentSkillEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\BuiltinAgent;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Event\SuperMagicAgentDeletedEvent;
use Dtyq\SuperMagic\Domain\Agent\Event\SuperMagicAgentDisabledEvent;
use Dtyq\SuperMagic\Domain\Agent\Event\SuperMagicAgentEnabledEvent;
use Dtyq\SuperMagic\Domain\Agent\Event\SuperMagicAgentSavedEvent;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentMarketRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentPlaybookRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentSkillRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentVersionRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\SuperMagicAgentRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Hyperf\DbConnection\Annotation\Transactional;

readonly class SuperMagicAgentDomainService
{
    public function __construct(
        protected SuperMagicAgentRepositoryInterface $superMagicAgentRepository,
        protected AgentSkillRepositoryInterface $agentSkillRepository,
        protected AgentPlaybookRepositoryInterface $agentPlaybookRepository,
        protected AgentMarketRepositoryInterface $storeAgentRepository,
        protected AgentVersionRepositoryInterface $agentVersionRepository
    ) {
    }

    public function getByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?SuperMagicAgentEntity
    {
        $this->checkBuiltinAgentOperation($code, $dataIsolation->getCurrentOrganizationCode());
        return $this->superMagicAgentRepository->getByCode($dataIsolation, $code);
    }

    /**
     * @return array{total: int, list: array<SuperMagicAgentEntity>}
     */
    public function queries(SuperMagicAgentDataIsolation $dataIsolation, SuperMagicAgentQuery $query, Page $page): array
    {
        $agents = $this->superMagicAgentRepository->queries($dataIsolation, $query, $page);
        foreach ($agents['list'] as $agent) {
            $agent->setName($agent->getI18nName($dataIsolation->getLanguage()));
            $agent->setDescription($agent->getI18nDescription($dataIsolation->getLanguage()));
        }
        return $agents;
    }

    public function save(SuperMagicAgentDataIsolation $dataIsolation, SuperMagicAgentEntity $savingEntity, bool $checkPrompt = true): SuperMagicAgentEntity
    {
        $savingEntity->setCreator($dataIsolation->getCurrentUserId());
        $savingEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());

        $isCreate = $savingEntity->shouldCreate();

        if ($isCreate) {
            $entity = clone $savingEntity;
            $entity->prepareForCreation($checkPrompt);
        } else {
            $this->checkBuiltinAgentOperation($savingEntity->getCode(), $dataIsolation->getCurrentOrganizationCode());

            $entity = $this->superMagicAgentRepository->getByCode($dataIsolation, $savingEntity->getCode());
            if (! $entity) {
                ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $savingEntity->getCode()]);
            }
            // 商店来源不允许修改
            if ($entity->getSourceType()->isMarket()) {
                ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'super_magic.agent.store_agent_cannot_update');
            }

            $savingEntity->prepareForModification($entity, $checkPrompt);
        }
        $savedEntity = $this->superMagicAgentRepository->save($dataIsolation, $entity);

        AsyncEventUtil::dispatch(new SuperMagicAgentSavedEvent($savedEntity, $isCreate));

        return $savedEntity;
    }

    /**
     * 直接保存 Agent（不触发事件，不检查内置agent等）.
     * 用于命令等特殊场景，直接调用 repository 保存.
     */
    public function saveDirectly(SuperMagicAgentDataIsolation $dataIsolation, SuperMagicAgentEntity $entity): SuperMagicAgentEntity
    {
        $savedEntity = $this->superMagicAgentRepository->save($dataIsolation, $entity);

        AsyncEventUtil::dispatch(new SuperMagicAgentSavedEvent($savedEntity, true));

        return $savedEntity;
    }

    public function delete(SuperMagicAgentDataIsolation $dataIsolation, string $code): bool
    {
        $this->checkBuiltinAgentOperation($code, $dataIsolation->getCurrentOrganizationCode());

        $entity = $this->superMagicAgentRepository->getByCode($dataIsolation, $code);
        if (! $entity) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }

        // 根据 source_type 决定删除策略
        if ($entity->getSourceType()->isMarket()) {
            // STORE 类型：仅软删除 Crew 记录
            $result = $this->superMagicAgentRepository->delete($dataIsolation, $code);
        } else {
            // LOCAL_CREATE 类型：删除所有相关数据
            $result = $this->superMagicAgentRepository->delete($dataIsolation, $code);
            $this->agentSkillRepository->deleteByAgentCode($dataIsolation, $entity->getCode());
            $this->agentPlaybookRepository->deleteByAgentCode($dataIsolation, $entity->getCode());
            $this->agentVersionRepository->deleteByAgentCode($dataIsolation, $code);
            $this->storeAgentRepository->offlineByAgentCode($dataIsolation, $code);
        }

        if ($result) {
            AsyncEventUtil::dispatch(new SuperMagicAgentDeletedEvent($entity));
        }

        return $result;
    }

    public function enable(SuperMagicAgentDataIsolation $dataIsolation, string $code): SuperMagicAgentEntity
    {
        $this->checkBuiltinAgentOperation($code, $dataIsolation->getCurrentOrganizationCode());
        $entity = $this->getByCodeWithException($dataIsolation, $code);

        $entity->setEnabled(true);
        $entity->setModifier($dataIsolation->getCurrentUserId());
        $entity->setUpdatedAt(new DateTime());

        $savedEntity = $this->superMagicAgentRepository->save($dataIsolation, $entity);

        AsyncEventUtil::dispatch(new SuperMagicAgentEnabledEvent($savedEntity));

        return $savedEntity;
    }

    public function disable(SuperMagicAgentDataIsolation $dataIsolation, string $code): SuperMagicAgentEntity
    {
        $this->checkBuiltinAgentOperation($code, $dataIsolation->getCurrentOrganizationCode());

        $entity = $this->getByCodeWithException($dataIsolation, $code);

        $entity->setEnabled(false);
        $entity->setModifier($dataIsolation->getCurrentUserId());
        $entity->setUpdatedAt(new DateTime());

        $savedEntity = $this->superMagicAgentRepository->save($dataIsolation, $entity);

        AsyncEventUtil::dispatch(new SuperMagicAgentDisabledEvent($savedEntity));

        return $savedEntity;
    }

    public function updateProject(SuperMagicAgentDataIsolation $dataIsolation, string $code, ?int $projectId): SuperMagicAgentEntity
    {
        $this->checkBuiltinAgentOperation($code, $dataIsolation->getCurrentOrganizationCode());

        $entity = $this->getByCodeWithException($dataIsolation, $code);

        $entity->setProjectId($projectId);
        $entity->setModifier($dataIsolation->getCurrentUserId());
        $entity->setUpdatedAt(new DateTime());

        return $this->superMagicAgentRepository->save($dataIsolation, $entity);
    }

    public function getByCodeWithException(SuperMagicAgentDataIsolation $dataIsolation, string $code): SuperMagicAgentEntity
    {
        $this->checkBuiltinAgentOperation($code, $dataIsolation->getCurrentOrganizationCode());

        $entity = $this->superMagicAgentRepository->getByCode($dataIsolation, $code);
        if (! $entity) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }

        return $entity;
    }

    /**
     * 根据 code 更新 Agent 的 updated_at 时间.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Agent code
     * @return bool 是否更新成功
     */
    #[Transactional]
    public function updateUpdatedAtByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): bool
    {
        $modifier = $dataIsolation->getCurrentUserId();
        return $this->superMagicAgentRepository->updateUpdatedAtByCode($dataIsolation, $code, $modifier);
    }

    /**
     * 获取指定创建者的智能体编码列表.
     * @return array<string>
     */
    public function getCodesByCreator(SuperMagicAgentDataIsolation $dataIsolation, string $creator): array
    {
        return $this->superMagicAgentRepository->getCodesByCreator($dataIsolation, $creator);
    }

    /**
     * 生成唯一的 code.
     * 格式：org_{organization_code}_{name_en_slug}
     * 如果已存在，则添加序号后缀（如 _2、_3）直到唯一.
     */
    public function generateUniqueCode(SuperMagicAgentDataIsolation $dataIsolation, string $nameEn): string
    {
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // 生成基础 code：转换为小写，空格替换为下划线，特殊字符过滤
        $slug = $this->generateSlug($nameEn);
        $baseCode = sprintf('org_%s_%s', $organizationCode, $slug);

        // 检查 code 是否已存在
        $code = $baseCode;
        $counter = 1;
        while ($this->superMagicAgentRepository->codeExists($dataIsolation, $code)) {
            ++$counter;
            $code = sprintf('%s_%d', $baseCode, $counter);
        }

        return $code;
    }

    /**
     * 根据 agent_code 查询商店状态（仅查询已发布的）.
     *
     * @param string $agentCode Agent code
     * @return null|bool 商店状态：true=已下架, false=未下架, null=非商店来源或不存在
     */
    public function getStoreAgentStatus(string $agentCode): ?bool
    {
        $storeAgent = $this->storeAgentRepository->findByAgentCode($agentCode);
        return $storeAgent === null ? true : false;
    }

    /**
     * 获取 Agent 详情（包含技能列表和 Playbook 列表）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $agentCode Agent code
     * @return SuperMagicAgentEntity Agent 实体（已包含技能列表和 Playbook 列表）
     */
    public function getDetail(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode): SuperMagicAgentEntity
    {
        $agent = $this->getByCodeWithException($dataIsolation, $agentCode);
        $agent->setName($agent->getI18nName($dataIsolation->getLanguage()));
        $agent->setDescription($agent->getI18nDescription($dataIsolation->getLanguage()));

        // 查询绑定的技能列表
        $skills = $this->agentSkillRepository->getByAgentCodeForCurrentVersion($dataIsolation, $agentCode);
        $agent->setSkills($skills);

        // 查询 Playbook 列表
        $playbooks = $this->agentPlaybookRepository->getByAgentCodeForCurrentVersion($dataIsolation, $agentCode);
        $agent->setPlaybooks($playbooks);

        return $agent;
    }

    /**
     * 批量根据 agent_code 列表查询商店状态（仅查询已发布的）.
     *
     * @param string[] $agentCodes Agent code 列表
     * @return array<string, AgentMarketEntity> 商店 Agent 实体数组，key 为 agent_code
     */
    public function getStoreAgentsByAgentCodes(array $agentCodes): array
    {
        return $this->storeAgentRepository->findByAgentCodes($agentCodes);
    }

    /**
     * 获取 Agent 详情并校验是否属于当前用户.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Agent code
     * @return SuperMagicAgentEntity Agent 实体
     */
    public function getByCodeWithUserCheck(SuperMagicAgentDataIsolation $dataIsolation, string $code): SuperMagicAgentEntity
    {
        $agent = $this->getByCodeWithException($dataIsolation, $code);

        // 校验是否属于当前用户
        if ($agent->getCreator() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }

        return $agent;
    }

    /**
     * 发布员工到商店（创建待审核版本）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param SuperMagicAgentEntity $agentEntity Agent 实体
     * @param array $icon Icon 图标
     * @param int $iconType Icon 类型
     * @return AgentVersionEntity 创建的版本实体
     */
    public function publishAgent(SuperMagicAgentDataIsolation $dataIsolation, SuperMagicAgentEntity $agentEntity, array $icon = [], int $iconType = 1): AgentVersionEntity
    {
        // 1. 校验来源类型：仅允许发布非商店来源的员工
        if ($agentEntity->getSourceType()->isMarket()) {
            ExceptionBuilder::throw(SuperMagicErrorCode::StoreAgentCannotPublish, 'super_magic.agent.store_agent_cannot_publish');
        }

        // 2. 查询该员工的最新版本号（用于版本号递增）
        $latestVersion = $this->agentVersionRepository->findLatestByCode($dataIsolation, $agentEntity->getCode());

        // 3. 自动递增版本号（从1开始递增：1, 2, 3, 4...）
        $newVersion = '1';
        if ($latestVersion) {
            $latestVersionNumber = (int) $latestVersion->getVersion();
            $newVersion = (string) ($latestVersionNumber + 1);
        }

        // 4. 从 name_i18n 提取 name（英文）
        $nameI18n = $agentEntity->getNameI18n();
        $name = $nameI18n[LanguageEnum::EN_US->value] ?? ($nameI18n[LanguageEnum::ZH_CN->value] ?? '');

        // 5. 从 description_i18n 提取 description（英文）
        $descriptionI18n = $agentEntity->getDescriptionI18n();
        $description = '';
        if ($descriptionI18n) {
            $description = $descriptionI18n[LanguageEnum::EN_US->value] ?? ($descriptionI18n[LanguageEnum::ZH_CN->value] ?? '');
        }

        // 6. 创建 Agent 版本记录（待发布、审核中状态）
        $versionEntity = new AgentVersionEntity();
        $versionEntity->setCode($agentEntity->getCode());
        $versionEntity->setOrganizationCode($agentEntity->getOrganizationCode());
        $versionEntity->setVersion($newVersion);
        $versionEntity->setName($name);
        $versionEntity->setDescription($description);
        $versionEntity->setIcon($agentEntity->getIcon());
        $versionEntity->setIconType($agentEntity->getIconType());
        $versionEntity->setType($agentEntity->getType()->value);
        $versionEntity->setEnabled($agentEntity->isEnabled());
        $versionEntity->setPrompt($agentEntity->getPrompt());
        $versionEntity->setTools($agentEntity->getTools());
        $versionEntity->setCreator($agentEntity->getCreator());
        $versionEntity->setModifier($agentEntity->getCreator()); // 初始值等于 creator
        $versionEntity->setNameI18n($agentEntity->getNameI18n());
        $versionEntity->setRoleI18n($agentEntity->getRoleI18n());
        $versionEntity->setDescriptionI18n($agentEntity->getDescriptionI18n());
        $versionEntity->setProjectId($agentEntity->getProjectId());
        $versionEntity->setPublishStatus(PublishStatus::UNPUBLISHED);
        $versionEntity->setReviewStatus(ReviewStatus::UNDER_REVIEW);

        // 7. 保存版本记录
        $versionEntity = $this->agentVersionRepository->save($dataIsolation, $versionEntity);

        // 8. 查询当前 Agent 绑定的 Skill 列表
        $agentSkills = $this->agentSkillRepository->getByAgentCodeForCurrentVersion($dataIsolation, $agentEntity->getCode());

        // 9. 复制 Skill 绑定关系到版本（补充 agent_version_id）
        if (! empty($agentSkills)) {
            $skillEntities = [];
            foreach ($agentSkills as $agentSkill) {
                $newSkillEntity = new AgentSkillEntity();
                $newSkillEntity->setAgentId($agentEntity->getId());
                $newSkillEntity->setAgentCode($agentSkill->getAgentCode());
                $newSkillEntity->setSkillId($agentSkill->getSkillId());
                $newSkillEntity->setSkillVersionId($agentSkill->getSkillVersionId());
                $newSkillEntity->setSkillCode($agentSkill->getSkillCode());
                $newSkillEntity->setSortOrder($agentSkill->getSortOrder());
                $newSkillEntity->setCreatorId($agentSkill->getCreatorId());
                $newSkillEntity->setAgentVersionId($versionEntity->getId());
                $newSkillEntity->setOrganizationCode($agentSkill->getOrganizationCode());
                $skillEntities[] = $newSkillEntity;
            }
            $this->agentSkillRepository->batchSave($dataIsolation, $skillEntities);
        }

        // 10. 复制 Playbook 到版本（补充 agent_version_id）
        $this->agentPlaybookRepository->batchCopyToVersion($dataIsolation, $agentEntity->getId(), $versionEntity->getId());

        return $versionEntity;
    }

    /**
     * 审核员工版本.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param int $versionId Agent 版本 ID
     * @param string $action 审核操作：APPROVED=通过, REJECTED=拒绝
     * @param string $modifier 修改者
     * @param null|string $publisherType 发布者类型（仅在 action=APPROVED 时有效）
     */
    public function reviewAgentVersion(
        SuperMagicAgentDataIsolation $dataIsolation,
        int $versionId,
        string $action,
        string $modifier,
        ?string $publisherType = null
    ): void {
        // 1. 查询待审核的版本
        $versionEntity = $this->agentVersionRepository->findPendingReviewById($dataIsolation, $versionId);
        if (! $versionEntity) {
            ExceptionBuilder::throw(SuperMagicErrorCode::AgentVersionNotFound, 'super_magic.agent.agent_version_not_found');
        }

        // 2. 校验状态（findPendingReviewById 已经过滤了状态，这里再次确认）
        if ($versionEntity->getPublishStatus() !== PublishStatus::UNPUBLISHED
            || $versionEntity->getReviewStatus() !== ReviewStatus::UNDER_REVIEW) {
            ExceptionBuilder::throw(SuperMagicErrorCode::CanOnlyReviewPendingVersion, 'super_magic.agent.can_only_review_pending_version');
        }

        // 3. 根据 action 执行不同逻辑
        if ($action === 'APPROVED') {
            // 审核通过
            $success = $this->agentVersionRepository->updateReviewStatus(
                $dataIsolation,
                $versionId,
                ReviewStatus::APPROVED,
                PublishStatus::PUBLISHED,
                $modifier
            );

            if (! $success) {
                ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'super_magic.operation_failed');
            }

            // 处理 publisher_type：如果用户传入了，使用用户传入的值，否则使用默认值 USER
            $publisherTypeEnum = PublisherType::USER;
            if ($publisherType) {
                $publisherTypeEnum = PublisherType::from($publisherType);
            }

            // 检查商店表中是否已存在该 agent_code 的记录
            $existingStoreAgent = $this->storeAgentRepository->findByAgentCodeWithoutStatus($versionEntity->getCode());

            // 创建或更新商店记录
            $storeAgentEntity = new AgentMarketEntity();
            $storeAgentEntity->setAgentCode($versionEntity->getCode());
            $storeAgentEntity->setAgentVersionId($versionEntity->getId());
            $storeAgentEntity->setNameI18n($versionEntity->getNameI18n());
            $storeAgentEntity->setDescriptionI18n($versionEntity->getDescriptionI18n());
            $storeAgentEntity->setRoleI18n($versionEntity->getRoleI18n());
            // icon 字段：从 versionEntity 的 icon 获取（已经是数组格式）
            $storeAgentEntity->setIcon($versionEntity->getIcon());
            $storeAgentEntity->setPublisherId($versionEntity->getCreator());
            $storeAgentEntity->setPublisherType($publisherTypeEnum);
            $storeAgentEntity->setCategoryId(null); // 保持为 NULL
            $storeAgentEntity->setPublishStatus(PublishStatus::PUBLISHED);
            $storeAgentEntity->setOrganizationCode($versionEntity->getOrganizationCode());

            if ($existingStoreAgent) {
                // 如果已存在，设置 ID 以便更新
                $storeAgentEntity->setId($existingStoreAgent->getId());
            }

            $this->storeAgentRepository->saveOrUpdate($dataIsolation, $storeAgentEntity);
        } else {
            // 审核拒绝
            $success = $this->agentVersionRepository->updateReviewStatus(
                $dataIsolation,
                $versionId,
                ReviewStatus::REJECTED,
                PublishStatus::UNPUBLISHED,
                $modifier
            );

            if (! $success) {
                ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'super_magic.operation_failed');
            }
        }
    }

    /**
     * 生成 slug：转换为小写，空格替换为下划线，特殊字符过滤.
     */
    private function generateSlug(string $text): string
    {
        // 转换为小写
        $slug = mb_strtolower($text, 'UTF-8');

        // 替换空格为下划线
        $slug = str_replace(' ', '_', $slug);

        // 过滤特殊字符，只保留字母、数字、下划线
        $slug = preg_replace('/[^a-z0-9_]/', '', $slug);

        // 移除连续的下划线
        $slug = preg_replace('/_+/', '_', $slug);

        // 移除首尾下划线
        return trim($slug, '_');
    }

    /**
     * 检查是否为内置智能体，如果是则抛出异常.
     */
    private function checkBuiltinAgentOperation(string $code, string $organizationCode): void
    {
        if (OfficialOrganizationUtil::isOfficialOrganization($organizationCode)) {
            return;
        }

        $builtinAgent = BuiltinAgent::tryFrom($code);
        if ($builtinAgent) {
            ExceptionBuilder::throw(SuperMagicErrorCode::BuiltinAgentNotAllowed, 'super_magic.agent.builtin_not_allowed');
        }
    }
}
