<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Message\Assembler;

use App\Application\SuperMagic\Message\Assembler\UserMessageDTOAssembler;
use App\Application\SuperMagic\Message\DTO\UserMessageDTO;
use App\Domain\Chat\DTO\Message\ChatMessage\RichTextMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\UserToolCallMessage;
use App\Domain\SuperMagic\Common\Entity\ValueObject\SuperMagicExecutionSource;
use App\Domain\SuperMagic\Message\Entity\ValueObject\ChatInstruction;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\SuperMagic\Utils\TiptapBuilder;
use HyperfTest\Cases\Application\SuperMagic\Support\OpenApiUnitTestTrait;
use PHPUnit\Framework\TestCase;

/** @internal */
final class UserMessageDTOAssemblerTest extends TestCase
{
    use OpenApiUnitTestTrait;

    public function testHttpAndWebSocketParseIdenticalFieldsAndPreserveQueuePayload(): void
    {
        $node = ['type' => 'mention', 'attrs' => ['type' => 'project_file', 'data' => ['file_id' => '12', 'file_name' => 'sales.csv', 'file_path' => 'inputs/sales.csv', 'project_id' => '9']]];
        $content = [
            'content' => TiptapBuilder::plainTextWithMentionsToJson('Analyze sales', [$node]),
            'instructs' => [['value' => 'follow_up'], ['value' => 'plan']],
            'extra' => ['super_agent' => [
                'topic_pattern' => 'general',
                'agent_code' => null,
                'model' => ['model_id' => 'model-1', 'model_name' => 'Model', 'model_icon' => 'icon'],
                'image_model' => ['model_id' => 'image-1'],
                'video_model' => ['model_id' => 'video-1'],
                'dynamic_params' => ['message_version' => 'v2'],
            ]],
        ];
        $topic = (new TopicEntity())->setId(9)->setChatTopicId('99');
        $http = UserMessageDTOAssembler::fromMessageContentStruct(new RichTextMessage($content), $topic, 'agent', 'rich_text', 'm1', 's1', 'zh_CN', SuperMagicExecutionSource::OpenApi);
        $wsFields = UserMessageDTOAssembler::parseMessageContent(new RichTextMessage($content), SuperMagicExecutionSource::HumanChat);
        $ws = UserMessageDTOAssembler::fromParsedMessage($wsFields, ['agent_user_id' => 'agent', 'topic_id' => 9, 'chat_topic_id' => '99', 'chat_conversation_id' => 'conversation', 'raw_content' => 'raw']);
        self::assertSame($http->getPrompt(), $ws->getPrompt());
        self::assertSame($http->getMentions(), $ws->getMentions());
        self::assertSame(ChatInstruction::FollowUp, $http->getInstruction());
        self::assertSame('plan', $http->getTaskMode());
        self::assertSame('model-1', $http->getModelId());
        $restored = UserMessageDTO::fromArray($http->toArray());
        self::assertSame($http->getMentions(), $restored->getMentions());
        self::assertSame('video-1', $restored->getExtra()->getVideoModelId());
        self::assertSame('raw', $ws->getRawContent());
        self::assertSame('conversation', $ws->getChatConversationId());
        self::assertSame('v2', $restored->getDynamicParams()['message_version']);
    }

    public function testExplicitMentionsRemainAuthoritativeAndBodyMentionsFillMissingExtra(): void
    {
        $body = ['type' => 'mention', 'attrs' => ['type' => 'project_file', 'data' => ['file_id' => '10']]];
        $explicit = ['type' => 'mention', 'attrs' => ['type' => 'project_file', 'data' => ['file_id' => '20']]];
        $content = TiptapBuilder::plainTextWithMentionsToJson('Read', [$body]);
        $fields = UserMessageDTOAssembler::parseMessageContent(new RichTextMessage(['content' => $content]), SuperMagicExecutionSource::HumanChat);
        self::assertSame('10', json_decode($fields['mentions'], true)[0]['file_id']);
        $fields = UserMessageDTOAssembler::parseMessageContent(new RichTextMessage(['content' => $content, 'extra' => ['super_agent' => ['mentions' => [$explicit]]]]), SuperMagicExecutionSource::HumanChat);
        self::assertSame('20', json_decode($fields['mentions'], true)[0]['file_id']);
    }

    public function testInstructionsPreserveModeBreakAndLastInstructionRules(): void
    {
        self::assertSame([ChatInstruction::Interrupted, ''], UserMessageDTOAssembler::parseInstructions([['value' => 'normal'], ['value' => 'interrupt']]));
        self::assertSame([ChatInstruction::Normal, 'plan'], UserMessageDTOAssembler::parseInstructions([['value' => 'plan'], ['value' => 'interrupt']]));
    }

    public function testNativeAndLegacyToolsSharePriorityAndLegacyFieldConversion(): void
    {
        $native = (new UserToolCallMessage())->setName('ask_user')->setToolCallId('call-native');
        self::assertSame($native, UserMessageDTOAssembler::resolveUserToolCallMessage($native, null));
        $legacy = UserMessageDTOAssembler::resolveUserToolCallMessage(null, ['tool_reply' => ['name' => 'ask_user', 'detail' => ['question_id' => 'call-old', 'task_id' => 'old-task', 'answer' => 'yes']]]);
        self::assertSame('call-old', $legacy->getToolCallId());
        self::assertSame(['answer' => 'yes'], $legacy->getDetail());
        self::assertSame('tool_reply', UserMessageDTOAssembler::classifyMessage(ChatInstruction::Interrupted, $legacy));
        self::assertSame('interrupt', UserMessageDTOAssembler::classifyMessage(ChatInstruction::Interrupted, null));
        self::assertSame('chat', UserMessageDTOAssembler::classifyMessage(ChatInstruction::FollowUp, null));
    }

    public function testCreationRejectsMalformedToolMarkerBeforeItBecomesChat(): void
    {
        $message = new RichTextMessage(['content' => TiptapBuilder::plainTextToJson('hello'), 'extra' => ['super_agent' => ['dynamic_params' => ['tool_reply' => ['detail' => []]]]]]);
        $fields = UserMessageDTOAssembler::parseMessageContent($message, SuperMagicExecutionSource::OpenApi);
        $this->expectException(BusinessException::class);
        UserMessageDTOAssembler::assertTaskCreationMessage($message, $fields);
    }
}
