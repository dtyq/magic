<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\SupperMagicMCP;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentDomainService;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

readonly class SupperMagicAgentSkill implements SupperMagicAgentSkillInterface
{
    protected LoggerInterface $logger;

    public function __construct(
        protected SuperMagicAgentDomainService $superMagicAgentDomainService,
        protected SkillDomainService $skillDomainService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('SupperMagicAgentSkill');
    }

    public function appendSkillDynamicConfig(DataIsolation $dataIsolation, TaskContext $taskContext): void
    {
        try {
            // todo 实现获取系统内置 skill 列表
            // Resolve agent code from dynamicConfig (set by handleChatMessage), extra, or agentMode
            $agentCode = $taskContext->getDynamicConfig()['agent_code']
                ?? $taskContext->getExtra()?->getAgentCode()
                ?: $taskContext->getAgentMode();

            if (empty($agentCode) || ! str_contains($agentCode, 'SMA-')) {
                return;
            }

            $agentDataIsolation = SuperMagicAgentDataIsolation::create(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId()
            );

            try {
                $agent = $this->superMagicAgentDomainService->getDetail($agentDataIsolation, $agentCode);
            } catch (Throwable $throwable) {
                $this->logger->notice('AppendSkillDynamicConfig: agent not found', [
                    'agent_code' => $agentCode,
                    'message' => $throwable->getMessage(),
                ]);
                return;
            }

            // Extract skill IDs bound to the agent
            $skillIds = array_values(array_filter(
                array_map(fn ($agentSkill) => $agentSkill->getSkillId(), $agent->getSkills())
            ));

            if (empty($skillIds)) {
                return;
            }

            $skillDataIsolation = SkillDataIsolation::create(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId()
            );
            $skillsMap = $this->skillDomainService->findSkillsByIds($skillDataIsolation, $skillIds);

            if (empty($skillsMap)) {
                return;
            }

            // Determine display language, fallback to 'zh'
            $lang = $taskContext->getDataIsolation()->getLanguage() ?: 'zh';

            $skills = [];
            /** @var SkillEntity $skill */
            foreach ($skillsMap as $skill) {
                $nameI18n = $skill->getNameI18n();
                $descI18n = $skill->getDescriptionI18n() ?? [];
                $skills[] = [
                    'id' => (string) $skill->getId(),
                    'code' => $skill->getCode(),
                    'name' => $nameI18n[$lang] ?? $nameI18n['zh'] ?? (string) reset($nameI18n),
                    'description' => $descI18n[$lang] ?? $descI18n['zh'] ?? '',
                    'version' => $skill->getVersionCode() ?? '',
                    'source' => $skill->getSourceType()->value,
                ];
            }

            $this->logger->debug('AppendSkillDynamicConfig', [
                'agent_code' => $agentCode,
                'skill_count' => count($skills),
            ]);

            // Filter out invalid skill mentions: only keep skill mentions owned by the current user
            $this->filterMentionedSkills($dataIsolation, $taskContext, $skillDataIsolation);
        } catch (Throwable $throwable) {
            $this->logger->error('AppendSkillDynamicConfigError', [
                'message' => $throwable->getMessage(),
                'file' => $throwable->getFile(),
                'line' => $throwable->getLine(),
            ]);
        }
    }

    /**
     * Filter invalid skill mentions from the task's mentions JSON.
     * Skill mentions whose id does not belong to the current user are silently removed.
     */
    private function filterMentionedSkills(DataIsolation $dataIsolation, TaskContext $taskContext, SkillDataIsolation $skillDataIsolation): void
    {
        $mentionsJson = $taskContext->getTask()->getMentions();
        if (empty($mentionsJson) || ! json_validate($mentionsJson)) {
            return;
        }

        $mentions = Json::decode($mentionsJson);
        if (empty($mentions)) {
            return;
        }

        // Collect skill IDs from mentions
        $mentionedSkillIds = [];
        foreach ($mentions as $mention) {
            if (($mention['type'] ?? '') === MentionType::SKILL->value && ! empty($mention['id'])) {
                $mentionedSkillIds[] = (int) $mention['id'];
            }
        }

        if (empty($mentionedSkillIds)) {
            return;
        }

        // Validate ownership: SQL filters by org + creator_id, returns only valid skills
        $validSkillsMap = $this->skillDomainService->findUserSkillsByIds($skillDataIsolation, $mentionedSkillIds);
        $validSkillIds = array_keys($validSkillsMap);

        $invalidCount = count($mentionedSkillIds) - count($validSkillIds);

        // Remove mentions that reference invalid (non-owned) skills
        $filtered = array_values(array_filter($mentions, function (array $mention) use ($validSkillIds): bool {
            if (($mention['type'] ?? '') !== MentionType::SKILL->value) {
                return true;
            }
            return in_array((int) ($mention['id'] ?? 0), $validSkillIds, true);
        }));

        $taskContext->getTask()->setMentions(Json::encode($filtered));

        if ($invalidCount > 0) {
            $this->logger->notice('FilterMentionedSkills: removed invalid skill mentions', [
                'user_id' => $dataIsolation->getCurrentUserId(),
                'removed_count' => $invalidCount,
            ]);
        }
    }
}
