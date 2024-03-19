<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Event;

class RunTaskBeforeEvent extends AbstractEvent
{
    /**
     * @param string $organizationCode Organization code
     * @param string $userId User ID
     * @param int $topicId Current topic ID
     * @param int $rounds Task rounds
     * @param int $currentTaskRunCount Currently running task count
     * @param int[] $runningTopicIds Running topic IDs
     * @param string[] $departmentIds Department IDs
     * @param string $language Language code
     * @param string $modelId Model ID
     * @param string $taskId Task ID
     * @param string $prompt Prompt content
     * @param string $mentions Mentions
     */
    public function __construct(
        private string $organizationCode,
        private string $userId,
        private int $topicId,
        private int $rounds,
        private int $currentTaskRunCount,
        private array $runningTopicIds,
        private array $departmentIds,
        private string $language,
        private string $modelId = '',
        private string $taskId = '',
        private string $prompt = '',
        private string $mentions = '',
    ) {
        // Call parent constructor to generate snowflake ID
        parent::__construct();
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getTopicId(): int
    {
        return $this->topicId;
    }

    public function getRounds(): int
    {
        return $this->rounds;
    }

    public function getCurrentTaskRunCount(): int
    {
        return $this->currentTaskRunCount;
    }

    /**
     * Get running topic IDs.
     *
     * @return int[]
     */
    public function getRunningTopicIds(): array
    {
        return $this->runningTopicIds;
    }

    /**
     * Get department IDs.
     *
     * @return string[]
     */
    public function getDepartmentIds(): array
    {
        return $this->departmentIds;
    }

    public function getLanguage(): string
    {
        return $this->language;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function getTaskId(): string
    {
        return $this->taskId;
    }

    public function getPrompt(): string
    {
        return $this->prompt;
    }

    public function getMentions(): string
    {
        return $this->mentions;
    }

    /**
     * Convert the event object to array format.
     */
    public function toArray(): array
    {
        return [
            'organizationCode' => $this->organizationCode,
            'userId' => $this->userId,
            'topicId' => $this->topicId,
            'rounds' => $this->rounds,
            'currentTaskRunCount' => $this->currentTaskRunCount,
            'runningTopicIds' => $this->runningTopicIds,
            'departmentIds' => $this->departmentIds,
            'language' => $this->language,
            'modelId' => $this->modelId,
            'taskId' => $this->taskId,
            'prompt' => $this->prompt,
            'mentions' => $this->mentions,
        ];
    }
}
