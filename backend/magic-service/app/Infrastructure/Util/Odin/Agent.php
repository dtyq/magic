<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Odin;

use Hyperf\Odin\Agent\Tool\ToolUseAgent;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Hyperf\Odin\Message\AssistantMessage;
use Hyperf\Odin\Message\UserMessage;

class Agent extends ToolUseAgent
{
    public function chatAndNotAutoExecuteTools(?UserMessage $input = null): ChatCompletionResponse
    {
        $gen = $this->call($input);
        $response = null;
        while ($gen->valid()) {
            /** @var ChatCompletionResponse $response */
            $response = $gen->current();
            $message = $response->getFirstChoice()?->getMessage();
            if ($message instanceof AssistantMessage && $message->hasToolCalls()) {
                break;
            }
            $gen->next();
        }
        return $response;
    }
}
