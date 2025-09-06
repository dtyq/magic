<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Constant;

use InvalidArgumentException;

/**
 * Agent event enumeration.
 */
enum AgentEventEnum: string
{
    case BEFORE_INIT = 'before_init';
    case AFTER_INIT = 'after_init';
    case BEFORE_SAFETY_CHECK = 'before_safety_check';
    case AFTER_SAFETY_CHECK = 'after_safety_check';
    case AFTER_CLIENT_CHAT = 'after_client_chat';
    case BEFORE_LLM_REQUEST = 'before_llm_request';
    case AFTER_LLM_REQUEST = 'after_llm_request';
    case BEFORE_TOOL_CALL = 'before_tool_call';
    case BEFORE_TOOL_CALL_EXPLANATION = 'before_tool_call_explanation';
    case PENDING_TOOL_CALL_EXPLANATION = 'pending_tool_call_explanation';
    case AFTER_TOOL_CALL = 'after_tool_call';
    case AGENT_SUSPENDED = 'agent_suspended';
    case BEFORE_MAIN_AGENT_RUN = 'before_main_agent_run';
    case AFTER_MAIN_AGENT_RUN = 'after_main_agent_run';

    /**
     * Get all valid event values.
     */
    public static function getValidEvents(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }

    /**
     * Check if event is valid.
     */
    public static function isValid(string $event): bool
    {
        return in_array($event, self::getValidEvents(), true);
    }

    /**
     * Create enum instance from string.
     */
    public static function fromString(string $event): self
    {
        return match ($event) {
            'before_init' => self::BEFORE_INIT,
            'after_init' => self::AFTER_INIT,
            'before_safety_check' => self::BEFORE_SAFETY_CHECK,
            'after_safety_check' => self::AFTER_SAFETY_CHECK,
            'after_client_chat' => self::AFTER_CLIENT_CHAT,
            'before_llm_request' => self::BEFORE_LLM_REQUEST,
            'after_llm_request' => self::AFTER_LLM_REQUEST,
            'before_tool_call' => self::BEFORE_TOOL_CALL,
            'before_tool_call_explanation' => self::BEFORE_TOOL_CALL_EXPLANATION,
            'pending_tool_call_explanation' => self::PENDING_TOOL_CALL_EXPLANATION,
            'after_tool_call' => self::AFTER_TOOL_CALL,
            'agent_suspended' => self::AGENT_SUSPENDED,
            'before_main_agent_run' => self::BEFORE_MAIN_AGENT_RUN,
            'after_main_agent_run' => self::AFTER_MAIN_AGENT_RUN,
            default => throw new InvalidArgumentException("Invalid agent event: {$event}"),
        };
    }

    /**
     * Get event description.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::BEFORE_INIT => 'Event triggered before agent initialization',
            self::AFTER_INIT => 'Event triggered after agent initialization',
            self::BEFORE_SAFETY_CHECK => 'Event triggered before safety check',
            self::AFTER_SAFETY_CHECK => 'Event triggered after safety check',
            self::AFTER_CLIENT_CHAT => 'Event triggered after client chat',
            self::BEFORE_LLM_REQUEST => 'Event triggered before LLM request',
            self::AFTER_LLM_REQUEST => 'Event triggered after LLM request',
            self::BEFORE_TOOL_CALL => 'Event triggered before tool call',
            self::BEFORE_TOOL_CALL_EXPLANATION => 'Event triggered before tool call explanation',
            self::PENDING_TOOL_CALL_EXPLANATION => 'Event triggered when tool call explanation is pending',
            self::AFTER_TOOL_CALL => 'Event triggered after tool call',
            self::AGENT_SUSPENDED => 'Event triggered when agent is suspended',
            self::BEFORE_MAIN_AGENT_RUN => 'Event triggered before main agent run',
            self::AFTER_MAIN_AGENT_RUN => 'Event triggered after main agent run',
        };
    }

    /**
     * Check if event is related to LLM operations.
     */
    public function isLLMRelated(): bool
    {
        return in_array($this, [
            self::BEFORE_LLM_REQUEST,
            self::AFTER_LLM_REQUEST,
        ], true);
    }

    /**
     * Check if event is related to tool operations.
     */
    public function isToolRelated(): bool
    {
        return in_array($this, [
            self::BEFORE_TOOL_CALL,
            self::BEFORE_TOOL_CALL_EXPLANATION,
            self::PENDING_TOOL_CALL_EXPLANATION,
            self::AFTER_TOOL_CALL,
        ], true);
    }

    /**
     * Check if event is related to agent lifecycle.
     */
    public function isLifecycleRelated(): bool
    {
        return in_array($this, [
            self::BEFORE_INIT,
            self::AFTER_INIT,
            self::BEFORE_MAIN_AGENT_RUN,
            self::AFTER_MAIN_AGENT_RUN,
            self::AGENT_SUSPENDED,
        ], true);
    }
}
