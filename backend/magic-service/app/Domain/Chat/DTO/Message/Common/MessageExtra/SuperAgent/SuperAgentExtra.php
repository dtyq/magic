<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent;

use App\Infrastructure\Core\AbstractDTO;

class SuperAgentExtra extends AbstractDTO
{
    /**
     * Mention related data for @ references.
     */
    protected ?array $mentions;

    /**
     * Input mode: chat | plan (only effective in general mode, deprecated in new version).
     */
    protected ?string $inputMode;

    /**
     * Chat mode: normal | follow_up | interrupt.
     */
    protected ?string $chatMode;

    /**
     * Task pattern: general | dataAnalysis | ppt | report.
     */
    protected ?string $taskPattern;

    public function getMentions(): ?array
    {
        return $this->mentions ?? null;
    }

    public function setMentions(?array $mentions): void
    {
        $this->mentions = $mentions;
    }

    public function getInputMode(): ?string
    {
        return $this->inputMode ?? null;
    }

    public function setInputMode(?string $inputMode): void
    {
        $this->inputMode = $inputMode;
    }

    public function getChatMode(): ?string
    {
        return $this->chatMode ?? null;
    }

    public function setChatMode(?string $chatMode): void
    {
        $this->chatMode = $chatMode;
    }

    public function getTaskPattern(): ?string
    {
        return $this->taskPattern ?? null;
    }

    public function setTaskPattern(?string $taskPattern): void
    {
        $this->taskPattern = $taskPattern;
    }
}
