<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Entity;

use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentSourceType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\BuiltinTool;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\Code;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentTool;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentToolType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentType;
use App\Domain\SuperMagic\Common\Entity\ResolvesI18nText;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use DateTime;

class SuperMagicAgentEntity extends AbstractEntity
{
    use ResolvesI18nText;

    protected ?int $id = null;

    protected string $organizationCode = '';

    /**
     * 唯一编码，仅在创建时生成，用作给前端的id.
     */
    protected string $code;

    /**
     * Agent名称.
     */
    protected string $name;

    /**
     * Agent描述.
     */
    protected string $description = '';

    /**
     * Agent图标.
     */
    protected ?array $icon = null;

    /**
     * 图标类型 1:图标 2:图片.
     */
    protected int $iconType = 1;

    /**
     * @var array<SuperMagicAgentTool>
     */
    protected array $tools = [];

    /**
     * 系统提示词.
     * Format: {"version": "1.0.0", "structure": {"string": "prompt text"}}.
     */
    protected array $prompt = [];

    /**
     * 智能体类型.
     */
    protected SuperMagicAgentType $type = SuperMagicAgentType::Custom;

    /**
     * 是否启用.
     */
    protected ?bool $enabled = null;

    protected string $creator;

    protected string $createdAt;

    protected string $modifier;

    protected string $updatedAt;

    /**
     * 绑定的技能列表.
     *
     * @var AgentSkillEntity[]
     */
    protected array $skills = [];

    /**
     * Playbook 列表.
     *
     * @var AgentPlaybookEntity[]
     */
    protected array $playbooks = [];

    /**
     * Agent 名称（多语言），格式：{"zh":"市场分析师","en":"Marketing Analyst"}.
     */
    protected ?array $nameI18n = null;

    /**
     * 角色定位（多语言），格式：{"zh":["市场分析师","内容创作者"],"en":["Marketing Analyst","Content Creator"]}.
     */
    protected ?array $roleI18n = null;

    /**
     * 核心职责与适用场景描述（多语言），格式：{"zh":"...","en":"..."}.
     */
    protected ?array $descriptionI18n = null;

    /**
     * 关联来源类型：LOCAL_CREATE=本地创建, MARKET/STORE=市场添加（兼容历史值）.
     */
    protected AgentSourceType $sourceType = AgentSourceType::LOCAL_CREATE;

    /**
     * 来源关联 ID：source_type=MARKET/STORE 时关联 magic_super_magic_agent_market.id，其余为 NULL.
     */
    protected ?int $sourceId = null;

    /**
     * 版本ID，对应 magic_super_magic_agent_versions.id；source_type=MARKET/STORE 时有值，其他为空.
     */
    protected ?int $versionId = null;

    /**
     * 版本号，对应市场原始 Agent code；source_type=MARKET/STORE 时有值，其他为空.
     */
    protected ?string $versionCode = null;

    /**
     * 置顶时间，NULL 表示未置顶.
     */
    protected ?string $pinnedAt = null;

    /**
     * 项目ID.
     */
    protected ?int $projectId = null;

    /**
     * Agent 文件key.
     */
    protected ?string $fileKey = null;

    /**
     * Note: File links must be obtained from the file service using the file_key.
     */
    protected ?string $fileUrl = null;

    /**
     * Latest published timestamp persisted on the agent record.
     */
    protected ?string $latestPublishedAt = null;

    /**
     * Category for agent classification.
     * Values: 'frequent', 'all'.
     */
    private string $category = 'all';

    private ?array $visibilityConfig = null;

    /**
     * 部分更新请求中实际提交的字段。
     *
     * @var null|array<string, bool>
     */
    private ?array $providedFields = null;

    public function shouldCreate(): bool
    {
        return empty($this->code);
    }

    public function prepareForCreation(bool $checkPrompt = true): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'organization_code']);
        }
        $this->hydrateScalarTextForWrite();
        if ($checkPrompt) {
            if (empty($this->name)) {
                ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'super_magic.agent.fields.name']);
            }

            if (empty($this->prompt)
                || ! isset($this->prompt['version'])
                || ! isset($this->prompt['structure'])) {
                ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'super_magic.agent.fields.prompt']);
            }
            // Check if prompt string content is empty
            if (empty(trim($this->getPromptString()))) {
                ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'super_magic.agent.fields.prompt']);
            }
        }

        if (empty($this->creator)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'creator']);
        }
        if (empty($this->createdAt)) {
            $this->createdAt = date('Y-m-d H:i:s');
        }

        $this->modifier = $this->creator;
        $this->updatedAt = $this->createdAt;
        $this->code = Code::SuperMagicAgent->gen();
        $this->enabled = $this->enabled ?? true;
        // 强制设置为自定义类型，用户创建的智能体只能是自定义类型
        $this->type = SuperMagicAgentType::Custom;
        $this->id = null;
        // 设置默认来源类型为本地创建
        if (! isset($this->sourceType)) {
            $this->sourceType = AgentSourceType::LOCAL_CREATE;
        }
        // 如果没有设置 name_i18n，从 name 字段生成
        if (empty($this->nameI18n) && ! empty($this->name)) {
            $this->nameI18n = $this->fillPublishI18nValues($this->nameI18n, $this->name);
        }
    }

    public function prepareForModification(SuperMagicAgentEntity $originalEntity, bool $checkPrompt): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'organization_code']);
        }
        $this->hydrateScalarTextForWrite();
        if ($checkPrompt) {
            if (empty($this->name)) {
                ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'super_magic.agent.fields.name']);
            }
            if (empty($this->prompt)
                || ! isset($this->prompt['version'])
                || ! isset($this->prompt['structure'])) {
                ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'super_magic.agent.fields.prompt']);
            }
            // Check if prompt string content is empty
            if (empty(trim($this->getPromptString()))) {
                ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.empty', ['label' => 'super_magic.agent.fields.prompt']);
            }
        }

        // 将新值设置到原始实体上
        $providedFields = $this->providedFields;
        if ($providedFields === null || ($providedFields['name_i18n'] ?? false)) {
            $originalEntity->setName($this->name);
        }
        if ($providedFields === null || ($providedFields['description_i18n'] ?? false)) {
            $originalEntity->setDescription($this->description);
        }
        if ($providedFields === null || ($providedFields['prompt_shadow'] ?? false)) {
            $originalEntity->setPrompt($this->prompt);
        }
        $originalEntity->setModifier($this->creator);
        if ($providedFields === null || ($providedFields['icon_type'] ?? false)) {
            $originalEntity->setIconType($this->iconType);
        }

        if (isset($this->enabled)) {
            $originalEntity->setEnabled($this->enabled);
        }

        if ($providedFields === null || ($providedFields['icon'] ?? false)) {
            $originalEntity->setIcon($this->icon);
        }

        // 更新多语言字段
        if ($providedFields === null || ($providedFields['name_i18n'] ?? false)) {
            $originalEntity->setNameI18n($this->nameI18n);
        }
        if ($providedFields === null || ($providedFields['role_i18n'] ?? false)) {
            $originalEntity->setRoleI18n($this->roleI18n);
        }
        if ($providedFields === null || ($providedFields['description_i18n'] ?? false)) {
            $originalEntity->setDescriptionI18n($this->descriptionI18n);
        }

        // 更新 project_id（如果设置了）
        if (isset($this->projectId)) {
            $originalEntity->setProjectId($this->projectId);
        }

        if ($providedFields === null || ($providedFields['file_key'] ?? false)) {
            $originalEntity->setFileKey($this->fileKey);
        }

        $originalEntity->setUpdatedAt(date('Y-m-d H:i:s'));
    }

    public function setProvidedFields(?array $providedFields): void
    {
        $this->providedFields = $providedFields;
    }

    // Getters and Setters
    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        if (is_string($id)) {
            $this->id = (int) $id;
        } else {
            $this->id = $id;
        }
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): void
    {
        $this->code = $code;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getIcon(): ?array
    {
        return $this->icon;
    }

    public function setIcon(?array $icon): void
    {
        $this->icon = $icon;
    }

    public function getIconType(): int
    {
        return $this->iconType;
    }

    public function setIconType(int $iconType): void
    {
        $this->iconType = $iconType;
    }

    public function getTools(): array
    {
        $result = [];
        $originalTools = [];
        foreach ($this->tools as $tool) {
            if ($tool->getType()->isBuiltIn() && ! BuiltinTool::isValidTool($tool->getCode())) {
                continue;
            }
            $originalTools[$tool->getCode()] = $tool;
        }

        // 获取必填工具列表，按照 getRequiredTools 的顺序
        $requiredTools = BuiltinTool::getDefaultToolsForAgentType($this->type);

        // 1. 先添加必填工具（按照 getRequiredTools 的顺序）
        foreach ($requiredTools as $requiredTool) {
            $tool = $originalTools[$requiredTool->value] ?? null;
            if ($tool === null) {
                $tool = new SuperMagicAgentTool();
                $tool->setCode($requiredTool->value);
                $tool->setName($requiredTool->getToolName());
                $tool->setDescription($requiredTool->getToolDescription());
                $tool->setIcon($requiredTool->getToolIcon());
                $tool->setType(SuperMagicAgentToolType::BuiltIn);
                $tool->setSchema(null);
            }

            $result[$tool->getCode()] = $tool;
            unset($originalTools[$tool->getCode()]);
        }

        // 2. 再添加原始工具列表中的其他工具（跳过已存在的必填工具）
        foreach ($originalTools as $tool) {
            if (! isset($result[$tool->getCode()])) {
                $result[$tool->getCode()] = $tool;
            }
        }

        return array_values($result);
    }

    /**
     * 获取原始工具列表（不包含自动添加的必填工具）.
     * @return array<SuperMagicAgentTool>
     */
    public function getOriginalTools(): array
    {
        return $this->tools;
    }

    public function setTools(array $tools): void
    {
        $this->tools = [];
        foreach ($tools as $tool) {
            if ($tool instanceof SuperMagicAgentTool) {
                $this->tools[] = $tool;
            } elseif (is_array($tool)) {
                $this->tools[] = new SuperMagicAgentTool($tool);
            }
        }
    }

    /**
     * 添加工具，如果工具已存在则不添加.
     */
    public function addTool(SuperMagicAgentTool $tool): void
    {
        if (array_any($this->tools, fn ($existingTool) => $existingTool->getCode() === $tool->getCode())) {
            return;
        }
        $this->tools[] = $tool;
    }

    public function getPrompt(): array
    {
        // Validate prompt format: must have version and structure keys
        if (empty($this->prompt)
            || ! isset($this->prompt['version'])
            || ! isset($this->prompt['structure'])) {
            return [];
        }

        return $this->prompt;
    }

    public function setPrompt(array $prompt): void
    {
        $this->prompt = $prompt;
    }

    /**
     * Get prompt as plain text string.
     *
     * @return string Plain text representation of the prompt
     */
    public function getPromptString(): string
    {
        $prompt = $this->getPrompt();
        if (empty($prompt)) {
            return '';
        }

        // Handle version 1.0.0 format
        if (isset($prompt['structure']['string'])) {
            return $prompt['structure']['string'];
        }

        return '';
    }

    public function getType(): SuperMagicAgentType
    {
        return $this->type;
    }

    public function setType(int|SuperMagicAgentType $type): void
    {
        if (is_int($type)) {
            $type = SuperMagicAgentType::tryFrom($type);
            if ($type === null) {
                ExceptionBuilder::throw(SuperMagicErrorCode::ValidateFailed, 'common.invalid', ['label' => 'super_magic.agent.fields.type']);
            }
        }
        $this->type = $type;
    }

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function isEnabled(): bool
    {
        return $this->enabled ?? false;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): void
    {
        $this->creator = $creator;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime|string $createdAt): void
    {
        if ($createdAt instanceof DateTime) {
            $this->createdAt = $createdAt->format('Y-m-d H:i:s');
        } else {
            $this->createdAt = $createdAt;
        }
    }

    public function getModifier(): string
    {
        return $this->modifier;
    }

    public function setModifier(string $modifier): void
    {
        $this->modifier = $modifier;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTime|string $updatedAt): void
    {
        if ($updatedAt instanceof DateTime) {
            $this->updatedAt = $updatedAt->format('Y-m-d H:i:s');
        } else {
            $this->updatedAt = $updatedAt;
        }
    }

    /**
     * 获取技能列表.
     *
     * @return AgentSkillEntity[]
     */
    public function getSkills(): array
    {
        return $this->skills;
    }

    /**
     * 设置技能列表.
     *
     * @param AgentSkillEntity[] $skills
     */
    public function setSkills(array $skills): void
    {
        $this->skills = $skills;
    }

    /**
     * 获取 Playbook 列表.
     *
     * @return AgentPlaybookEntity[]
     */
    public function getPlaybooks(): array
    {
        return $this->playbooks;
    }

    /**
     * 设置 Playbook 列表.
     *
     * @param AgentPlaybookEntity[] $playbooks
     */
    public function setPlaybooks(array $playbooks): void
    {
        $this->playbooks = $playbooks;
    }

    public function getCategory(): string
    {
        return $this->category;
    }

    public function setCategory(string $category): void
    {
        $this->category = $category;
    }

    public function getVisibilityConfig(): ?array
    {
        return $this->visibilityConfig;
    }

    public function setVisibilityConfig(?array $visibilityConfig): void
    {
        $this->visibilityConfig = $visibilityConfig;
    }

    public function getNameI18n(): ?array
    {
        return $this->nameI18n;
    }

    public function setNameI18n(?array $nameI18n): void
    {
        $this->nameI18n = $nameI18n;
    }

    public function getRoleI18n(): ?array
    {
        return $this->roleI18n;
    }

    public function setRoleI18n(?array $roleI18n): void
    {
        $this->roleI18n = $roleI18n;
    }

    public function getDescriptionI18n(): ?array
    {
        return $this->descriptionI18n;
    }

    public function setDescriptionI18n(?array $descriptionI18n): void
    {
        $this->descriptionI18n = $descriptionI18n;
    }

    public function getI18nName(string $language): string
    {
        return $this->resolveI18nText($this->nameI18n, $language) ?: $this->name;
    }

    public function getI18nDescription(string $language): string
    {
        return $this->resolveI18nText($this->descriptionI18n, $language) ?: $this->description;
    }

    /**
     * Get localized role string.
     * roleI18n format: {"zh_CN": ["角色1", "角色2"], "en_US": ["Role1", "Role2"]}.
     * Falls back through the standard locale order, then to getPromptString().
     */
    public function getI18nRole(string $language): string
    {
        foreach ([$language, LanguageEnum::DEFAULT->value, LanguageEnum::EN_US->value, LanguageEnum::ZH_CN->value] as $key) {
            $role = $this->formatRoleArray($this->roleI18n[$key] ?? null);
            if ($role !== '') {
                return $role;
            }
        }

        foreach ($this->roleI18n ?? [] as $roles) {
            $role = $this->formatRoleArray($roles);
            if ($role !== '') {
                return $role;
            }
        }

        return $this->getPromptString();
    }

    public function hydrateScalarTextForWrite(): void
    {
        $this->name = $this->resolveWriteTextFallback($this->name ?? '', $this->nameI18n);
        $this->description = $this->resolveWriteTextFallback($this->description, $this->descriptionI18n);
    }

    public function hydrateI18nForPublish(): void
    {
        $resolvedName = $this->resolvePublishTextFallback($this->name, $this->nameI18n);
        if ($resolvedName !== '') {
            $this->name = $resolvedName;
            $this->nameI18n = $this->fillPublishI18nValues($this->nameI18n, $resolvedName);
        }

        $resolvedDescription = $this->resolvePublishTextFallback($this->description, $this->descriptionI18n);
        if ($resolvedDescription !== '') {
            $this->description = $resolvedDescription;
            $this->descriptionI18n = $this->fillPublishI18nValues($this->descriptionI18n, $resolvedDescription);
        }
    }

    public function getSourceType(): AgentSourceType
    {
        return $this->sourceType;
    }

    public function setSourceType(AgentSourceType|string $sourceType): void
    {
        if ($sourceType instanceof AgentSourceType) {
            $this->sourceType = $sourceType;
        } else {
            $this->sourceType = AgentSourceType::tryFrom($sourceType) ?? AgentSourceType::LOCAL_CREATE;
        }
    }

    public function getSourceId(): ?int
    {
        return $this->sourceId;
    }

    public function setSourceId(null|int|string $sourceId): void
    {
        if ($sourceId === null) {
            $this->sourceId = null;
        } else {
            $this->sourceId = is_string($sourceId) ? (int) $sourceId : $sourceId;
        }
    }

    public function getVersionId(): ?int
    {
        return $this->versionId;
    }

    public function setVersionId(null|int|string $versionId): void
    {
        if ($versionId === null) {
            $this->versionId = null;
        } else {
            $this->versionId = is_string($versionId) ? (int) $versionId : $versionId;
        }
    }

    public function getVersionCode(): ?string
    {
        return $this->versionCode;
    }

    public function setVersionCode(?string $versionCode): void
    {
        $this->versionCode = $versionCode;
    }

    public function getPinnedAt(): ?string
    {
        return $this->pinnedAt;
    }

    public function setPinnedAt(?string $pinnedAt): void
    {
        $this->pinnedAt = $pinnedAt;
    }

    public function getProjectId(): ?int
    {
        return $this->projectId;
    }

    public function setProjectId(?int $projectId): void
    {
        $this->projectId = $projectId;
    }

    public function getFileKey(): ?string
    {
        return $this->fileKey;
    }

    public function setFileKey(?string $fileKey): void
    {
        $this->fileKey = $fileKey;
    }

    /**
     * Note: File links must be obtained from the file service using the file_key.
     */
    public function getFileUrl(): ?string
    {
        return $this->fileUrl;
    }

    /**
     * Note: File links will not be stored in the database.
     */
    public function setFileUrl(?string $fileUrl): void
    {
        $this->fileUrl = $fileUrl;
    }

    public function getLatestPublishedAt(): ?string
    {
        return $this->latestPublishedAt;
    }

    public function setLatestPublishedAt(?string $latestPublishedAt): void
    {
        $this->latestPublishedAt = $latestPublishedAt;
    }

    private function formatRoleArray(mixed $roles): string
    {
        if (is_array($roles)) {
            return implode(', ', array_filter($roles, static fn ($item) => is_string($item) && $item !== ''));
        }

        return is_string($roles) ? $roles : '';
    }

    /**
     * 发布前优先使用主字段文本，主字段为空时再从多语言内容里取首个非空值作为兜底。
     */
    private function resolvePublishTextFallback(string $text, ?array $i18n): string
    {
        $text = trim($text);
        if ($text !== '') {
            return $text;
        }

        return $this->resolveI18nTextFallback($i18n);
    }

    private function resolveWriteTextFallback(string $text, ?array $i18n): string
    {
        if (trim($text) !== '') {
            return $text;
        }

        return $this->resolveI18nTextFallback($i18n);
    }

    private function resolveI18nTextFallback(?array $i18n): string
    {
        return $this->resolveI18nText($i18n, LanguageEnum::DEFAULT->value);
    }

    /**
     * 使用兜底文案补齐空缺的多语言字段，避免发布后的 i18n 结构存在空值。
     */
    private function fillPublishI18nValues(?array $i18n, string $fallback): array
    {
        $i18n = is_array($i18n) ? $i18n : [];
        $fallback = trim($fallback);
        if ($fallback === '') {
            return $i18n;
        }

        foreach (LanguageEnum::getAllLanguageCodes() as $languageCode) {
            if (trim((string) ($i18n[$languageCode] ?? '')) === '') {
                $i18n[$languageCode] = $fallback;
            }
        }

        return $i18n;
    }
}
