<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Provider\DTO\Item;

use App\Domain\Provider\DTO\Item\ModelConfigItem;
use App\Domain\Provider\Entity\ProviderModelConfigVersionEntity;
use Hyperf\Odin\Constants\ChatApi;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class ModelConfigItemTest extends TestCase
{
    public function testChatApiDefaultsToChatCompletions(): void
    {
        $config = new ModelConfigItem();

        $this->assertSame(ChatApi::CHAT_COMPLETIONS, $config->getChatApi());
        $this->assertSame(ChatApi::CHAT_COMPLETIONS, $config->toArray()['chat_api']);
    }

    public function testChatApiAcceptsResponses(): void
    {
        $config = new ModelConfigItem(['chat_api' => ChatApi::RESPONSES]);

        $this->assertSame(ChatApi::RESPONSES, $config->getChatApi());
    }

    public function testChatApiFallsBackOnInvalidValue(): void
    {
        $config = new ModelConfigItem(['chat_api' => 'unknown']);

        $this->assertSame(ChatApi::CHAT_COMPLETIONS, $config->getChatApi());

        $config->setChatApi(null);
        $this->assertSame(ChatApi::CHAT_COMPLETIONS, $config->getChatApi());

        $config->setChatApi('');
        $this->assertSame(ChatApi::CHAT_COMPLETIONS, $config->getChatApi());
    }

    /** 历史模型缺失档位时默认三档，关闭开关不丢失配置。 */
    public function testReasoningLevelsPreserveLegacyAndDisabledSemantics(): void
    {
        $config = new ModelConfigItem(['support_deep_think' => true]);
        $this->assertNull($config->getReasoningEffortLevels());
        $this->assertSame(['low', 'medium', 'high'], $config->getEffectiveReasoningEffortLevels());
        $config->setReasoningEffortLevels(['max', 'none', 'max', 'low']);
        $this->assertSame(['none', 'low', 'max'], $config->getReasoningEffortLevels());
        $config->setSupportDeepThink(false);
        $this->assertSame([], $config->getEffectiveReasoningEffortLevels());
        $config->setSupportDeepThink(true);
        $this->assertSame(['none', 'low', 'max'], $config->getEffectiveReasoningEffortLevels());
        $config->setReasoningEffortLevels([]);
        $this->assertSame([], $config->getEffectiveReasoningEffortLevels());
    }

    /** 模型版本恢复后保留原始空值与显式空数组的区别。 */
    public function testReasoningLevelsSurviveVersionRoundTrip(): void
    {
        foreach ([null, [], ['low', 'high']] as $levels) {
            $version = new ProviderModelConfigVersionEntity(['reasoning_effort_levels' => $levels]);
            $restored = new ModelConfigItem(['support_deep_think' => true, 'reasoning_effort_levels' => $version->toArray()['reasoning_effort_levels']]);
            $this->assertSame($levels, $restored->getReasoningEffortLevels());
        }
    }
}
