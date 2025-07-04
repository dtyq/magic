<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionInterface;
use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Agent\Assembler\MentionAssembler;
use Hyperf\Codec\Json;

class SuperAgentExtra extends AbstractDTO
{
    /**
     * Mention related data for @ references.
     * @var null|MentionInterface[]
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

    /**
     * 为了方便大模型进行 function call，这里将 @ 的内容转为文本格式.
     */
    public function getMentionsTextStruct(): ?string
    {
        $textStruct = [];
        foreach ($this->mentions as $mention) {
            $textStruct[] = $mention->getMentionTextStruct();
        }
        if (empty($textStruct)) {
            return null;
        }
        return Json::encode($textStruct);
    }

    public function getMentions(): ?array
    {
        return $this->mentions ?? null;
    }

    public function setMentions(?array $mentions): void
    {
        if (empty($mentions)) {
            return;
        }
        $converted = [];
        foreach ($mentions as $mention) {
            if ($mention instanceof MentionInterface) {
                $converted[] = $mention;
                continue;
            }

            if (! is_array($mention)) {
                continue;
            }

            $mentionObj = MentionAssembler::fromArray($mention);
            if ($mentionObj instanceof MentionInterface) {
                $converted[] = $mentionObj;
            }
        }
        $this->mentions = $converted;
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
