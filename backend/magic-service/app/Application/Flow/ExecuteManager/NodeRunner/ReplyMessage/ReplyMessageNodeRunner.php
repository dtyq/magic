<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\ReplyMessage;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\Flow\ExecuteManager\Attachment\AbstractAttachment;
use App\Application\Flow\ExecuteManager\Compressible\CompressibleContent;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionType;
use App\Application\Flow\ExecuteManager\ExecutionData\FlowStreamStatus;
use App\Application\Flow\ExecuteManager\Memory\LLMMemoryMessage;
use App\Application\Flow\ExecuteManager\Message\MessageUtil;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Application\Flow\ExecuteManager\NodeRunner\ReplyMessage\Struct\MagicStreamTextProcessor;
use App\Application\Flow\ExecuteManager\NodeRunner\ReplyMessage\Struct\Message;
use App\Application\Flow\ExecuteManager\NodeRunner\ReplyMessage\Struct\StreamResponse;
use App\Application\Flow\ExecuteManager\Stream\FlowEventStreamManager;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\Chat\DTO\Message\StreamMessage\StreamMessageStatus;
use App\Domain\Chat\DTO\Message\StreamMessage\StreamOptions;
use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\MagicFlowMessage;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\ReplyMessage\ReplyMessageNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Routine\TopicConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\FlowExprEngine\ComponentFactory;
use Generator;
use Hyperf\Coroutine\Parallel;
use Hyperf\DbConnection\Db;
use Hyperf\Odin\Api\Response\ChatCompletionChoice;
use Hyperf\Odin\Message\AssistantMessage;
use Hyperf\Odin\Message\Role;
use Throwable;

use function Hyperf\Translation\__;

#[FlowNodeDefine(type: NodeType::ReplyMessage->value, code: NodeType::ReplyMessage->name, name: '回复消息', paramsConfig: ReplyMessageNodeParamsConfig::class, version: 'v0', singleDebug: false, needInput: false, needOutput: false)]
class ReplyMessageNodeRunner extends NodeRunner
{
    /**
     * @throws Throwable
     */
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        /** @var ReplyMessageNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        // 如果具有 大模型的流式响应体，那么直接开始
        if ($executionData->getExecutionType()->isSupportStream() && ! empty($frontResults['chat_completion_choice_generator'])) {
            $streamResponse = $this->sendMessageForStream($executionData, $frontResults);
            // 生成大模型节点的响应给回去
            $vertexResult->addDebugLog('llm_stream_response', $streamResponse->getLlmStreamResponse());
            $vertexResult->addDebugLog('llm_stream_reasoning_response', $streamResponse->getLlmStreamReasoningResponse());
            return;
        }

        $magicFlowMessage = new MagicFlowMessage(
            $paramsConfig->getType(),
            $paramsConfig->getContent(),
            $paramsConfig->getLink(),
            $paramsConfig->getLinkDesc()
        );

        // 如果是资源类的数据，那么需要提前上传了
        $links = $magicFlowMessage->getLinks($executionData->getExpressionFieldData());
        $attachments = $this->recordFlowExecutionAttachments($executionData, $links);
        // 由于里面会进行重命名，所以这里直接获取对应的名称传入进去
        $linkPaths = array_map(function (AbstractAttachment $attachment) {
            return $attachment->getPath();
        }, $attachments);

        $IMResponse = MessageUtil::getIMResponse($magicFlowMessage, $executionData, $linkPaths);
        if ($IMResponse === null) {
            return;
        }
        $vertexResult->addDebugLog('message', $IMResponse->toArray());
        $vertexResult->setResult($IMResponse->toArray());

        match ($executionData->getExecutionType()) {
            ExecutionType::IMChat => $this->sendMessageForChat($executionData, $IMResponse),
            ExecutionType::SKApi, ExecutionType::OpenPlatformApi, ExecutionType::Debug => $this->sendMessageForApi($executionData, $IMResponse, $frontResults),
            ExecutionType::Routine => $this->sendMessageForRoutineUsers($executionData, $IMResponse),
            default => null,
        };
    }

    protected function sendMessageForStream(ExecutionData $executionData, array $frontResults): StreamResponse
    {
        $streamResponse = new StreamResponse();

        /** @var Generator $chatCompletionChoiceGenerator */
        $chatCompletionChoiceGenerator = $frontResults['chat_completion_choice_generator'];

        // Api 调用
        if ($executionData->getExecutionType()->isApi()) {
            $this->sendMessageForStreamApi($executionData, $chatCompletionChoiceGenerator, $streamResponse);
        }

        // Chat 调用，每次流式都是一条新消息
        if ($executionData->getExecutionType()->isImChat()) {
            $this->sendMessageForStreamIMChat($executionData, $chatCompletionChoiceGenerator, $streamResponse);
        }

        $executionData->setStreamStatus(FlowStreamStatus::Processing);

        return $streamResponse;
    }

    protected function sendMessageForChat(ExecutionData $executionData, MessageInterface $IMResponse): void
    {
        if ($executionData->getExecutionType()->isDebug()) {
            return;
        }

        $receiveSeqDTO = new MagicSeqEntity();
        $receiveSeqDTO->setContent($IMResponse);
        $receiveSeqDTO->setSeqType($IMResponse->getMessageTypeEnum());
        $senderUser = $executionData->getSenderEntities()['user'] ?? null;
        $receiverId = $senderUser?->getUserId() ?? $executionData->getOperator()->getUid();
        if ($flowSeqEntity = $executionData->getSenderEntities()['seq'] ?? null) {
            $receiveSeqDTO->setExtra($flowSeqEntity->getExtra()?->getExtraCanCopyData());
            $receiveSeqDTO->setReferMessageId($flowSeqEntity->getMessageId());
        }
        $magicChatMessageAppService = di(MagicChatMessageAppService::class);
        $magicChatMessageAppService->agentSendMessage(
            aiSeqDTO: $receiveSeqDTO,
            senderUserId: $executionData->getAgentUserId(),
            receiverId: $receiverId,
            appMessageId: IdGenerator::getUniqueId32()
        );
    }

    protected function sendMessageForApi(ExecutionData $executionData, MessageInterface $IMResponse, array $frontResults): void
    {
        $id = IdGenerator::getUniqueId32();
        $messageStruct = new Message($IMResponse->toArray(), $executionData->getOriginConversationId(), $IMResponse, version: $executionData->getStreamVersion());
        $messageStruct->setId($id);
        if ($executionData->isStream()) {
            // 开始
            $startMessageStruct = new Message([], $executionData->getOriginConversationId(), version: $executionData->getStreamVersion());
            $startMessageStruct->setId($id);
            FlowEventStreamManager::write($startMessageStruct->toSteamResponse('start'));
            FlowEventStreamManager::write($messageStruct->toSteamResponse('message'));

            $executionData->setStreamStatus(FlowStreamStatus::Processing);
        } else {
            $executionData->addReplyMessage($messageStruct);
        }
        $content = '';
        if ($IMResponse instanceof TextContentInterface) {
            $content = $IMResponse->getTextContent();
        }

        $LLMMemoryMessage = new LLMMemoryMessage(Role::Assistant, $content, $id);
        $LLMMemoryMessage->setConversationId($executionData->getConversationId());
        $LLMMemoryMessage->setAttachments($executionData->getTriggerData()->getAttachments());
        $LLMMemoryMessage->setOriginalContent(MagicFlowMessage::createContent($IMResponse));
        $LLMMemoryMessage->setTopicId($executionData->getTopicIdString());
        $LLMMemoryMessage->setRequestId($executionData->getId());
        $LLMMemoryMessage->setUid($executionData->getAgentUserId() ?: $executionData->getOperator()->getUid());

        $this->flowMemoryManager->reply(
            memoryType: $this->getMemoryType($executionData),
            LLMMemoryMessage: $LLMMemoryMessage,
            nodeDebug: $this->isNodeDebug($executionData),
        );
    }

    protected function sendMessageForRoutineUsers(ExecutionData $executionData, MessageInterface $IMResponse): void
    {
        if ($executionData->getExecutionType()->isDebug()) {
            return;
        }

        /** @var ReplyMessageNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $userIds = $this->getUserIds($paramsConfig, $executionData);
        if (empty($userIds)) {
            return;
        }

        $routineConfig = $executionData->getTriggerData()->getParams()['routine_config'] ?? [];
        $topicConfig = new TopicConfig($routineConfig['topic']['type'] ?? '', ComponentFactory::fastCreate($routineConfig['topic']['name'] ?? []));

        $aiUserId = $executionData->getAgentUserId();
        $magicChatMessageAppService = di(MagicChatMessageAppService::class);

        $parallel = new Parallel(10);
        foreach ($userIds as $userId) {
            $parallel->add(function () use ($IMResponse, $userId, $aiUserId, $magicChatMessageAppService) {
                $receiveSeqDTO = new MagicSeqEntity();
                $receiveSeqDTO->setContent($IMResponse);
                $receiveSeqDTO->setSeqType($IMResponse->getMessageTypeEnum());

                // todo 根据开始节点配置的话题来选择话题

                $magicChatMessageAppService->agentSendMessage($receiveSeqDTO, $aiUserId, $userId, IdGenerator::getUniqueId32());
            });
        }
        $parallel->wait();
    }

    private function sendMessageForStreamApi(ExecutionData $executionData, Generator $chatCompletionChoiceGenerator, StreamResponse $streamResponse): void
    {
        $id = IdGenerator::getUniqueId32();
        $conversationId = $executionData->getOriginConversationId();
        $version = $executionData->getStreamVersion();

        $messageStruct = new Message([], $conversationId, version: $version);
        $messageStruct->setId($id);
        FlowEventStreamManager::write($messageStruct->toSteamResponse('start'));

        $outputCall = function (string $data, array $compressibleContent, array $params) use ($id, $conversationId, $version) {
            if (! empty($compressibleContent)) {
                // 如果有压缩内容，那么解压数据再输出
                $data = CompressibleContent::deCompress($data, false);
            }

            /** @var StreamResponse $streamResponse */
            $streamResponse = $params['streamResponse'];

            $message = [
                'role' => Role::Assistant->value,
                'content' => '',
            ];
            if ($params['reasoning']) {
                $message['reasoning_content'] = $data;
                $streamResponse->appendLLMStreamReasoningResponse($data);
            } else {
                $message['content'] = $data;
                $streamResponse->appendLLMStreamResponse($data);
            }
            $messageStruct = new Message(
                message: $message,
                conversationId: $conversationId,
                version: $version
            );
            $messageStruct->setId($id);
            $messageStruct->setChoice($params['choice']);

            FlowEventStreamManager::write($messageStruct->toSteamResponse('message'));
        };
        $magicStreamTextProcessor = new MagicStreamTextProcessor($outputCall);

        $reasoning = false;
        $lastChoice = null;
        /** @var ChatCompletionChoice $choice */
        foreach ($chatCompletionChoiceGenerator as $choice) {
            $lastChoice = $choice;
            $choiceMessage = $choice->getMessage();
            if ($choiceMessage instanceof AssistantMessage) {
                $streamContent = $choiceMessage->getReasoningContent() ?? $choiceMessage->getContent();
                $reasoning = $choiceMessage->hasReasoningContent();
            } else {
                $streamContent = $choiceMessage->getContent();
                $reasoning = false;
            }

            $magicStreamTextProcessor->process($streamContent, [
                'reasoning' => $reasoning,
                'choice' => $choice,
                'streamResponse' => $streamResponse,
            ]);
        }
        $magicStreamTextProcessor->end([
            'reasoning' => $reasoning,
            'choice' => $lastChoice,
            'streamResponse' => $streamResponse,
        ]);
    }

    private function sendMessageForStreamIMChat(ExecutionData $executionData, Generator $chatCompletionChoiceGenerator, StreamResponse $streamResponse): void
    {
        $chatAppService = di(MagicChatMessageAppService::class);

        $appMessageId = IdGenerator::getUniqueId32();

        $aiUserId = $executionData->getAgentUserId();
        $senderUser = $executionData->getSenderEntities()['user'] ?? null;
        $receiveUserId = $senderUser?->getUserId() ?? $executionData->getOperator()->getUid();

        $streamOptions = (new StreamOptions())->setStream(true)->setStatus(StreamMessageStatus::Start);
        $messageContent = new TextMessage();
        $messageContent->setContent('');
        $messageContent->setStreamOptions($streamOptions);
        $receiveSeqDTO = (new MagicSeqEntity())
            ->setSeqType(ChatMessageType::Text)
            ->setReferMessageId('')
            ->setContent($messageContent);

        if ($flowSeqEntity = $executionData->getSenderEntities()['seq'] ?? null) {
            $receiveSeqDTO->setExtra($flowSeqEntity->getExtra()?->getExtraCanCopyData());
            $receiveSeqDTO->setReferMessageId($flowSeqEntity->getMessageId());
        }

        // 发送开始标记
        $chatAppService->agentSendMessage($receiveSeqDTO, $aiUserId, $receiveUserId, $appMessageId, receiverType: ConversationType::User);

        $outputCall = function (string $data, array $compressibleContent, array $params) use ($chatAppService, $appMessageId, $aiUserId, $receiveUserId) {
            if (! empty($compressibleContent)) {
                // 如果有压缩内容，那么解压数据再输出
                $data = CompressibleContent::deCompress($data, false);
            }

            $receiveSeqDTO = $params['receiveSeqDTO'];
            $streamOptions = $params['streamOptions'];

            /** @var StreamResponse $streamResponse */
            $streamResponse = $params['streamResponse'];

            $streamOptions->setStatus(StreamMessageStatus::Processing);
            $messageContent = new TextMessage();
            $messageContent->setStreamOptions($streamOptions);
            if ($params['reasoning']) {
                $messageContent->setContent('')->setReasoningContent($data);
                $streamResponse->appendLLMStreamReasoningResponse($data);
            } else {
                $messageContent->setContent($data)->setReasoningContent(null);
                $streamResponse->appendLLMStreamResponse($data);
            }

            $receiveSeqDTO->setContent($messageContent);
            $chatAppService->agentSendMessage($receiveSeqDTO, $aiUserId, $receiveUserId, $appMessageId, receiverType: ConversationType::User);
        };
        $magicStreamTextProcessor = new MagicStreamTextProcessor($outputCall);

        $reasoning = false;
        try {
            /** @var ChatCompletionChoice $choice */
            foreach ($chatCompletionChoiceGenerator as $choice) {
                $choiceMessage = $choice->getMessage();
                if ($choiceMessage instanceof AssistantMessage) {
                    $streamContent = $choiceMessage->getReasoningContent() ?? $choiceMessage->getContent();
                    $reasoning = $choiceMessage->hasReasoningContent();
                } else {
                    $streamContent = $choiceMessage->getContent();
                    $reasoning = false;
                }

                $magicStreamTextProcessor->process($streamContent, [
                    'streamOptions' => $streamOptions,
                    'receiveSeqDTO' => $receiveSeqDTO,
                    'reasoning' => $reasoning,
                    'streamResponse' => $streamResponse,
                ]);
            }
            $magicStreamTextProcessor->end([
                'streamOptions' => $streamOptions,
                'receiveSeqDTO' => $receiveSeqDTO,
                'reasoning' => $reasoning,
                'streamResponse' => $streamResponse,
            ]);
        } catch (Throwable $throwable) {
            $this->logger->error('ChatStreamError', [
                'error' => $throwable->getMessage(),
                'code' => $throwable->getCode(),
                'file' => $throwable->getFile(),
                'line' => $throwable->getLine(),
                'trace' => $throwable->getTraceAsString(),
            ]);
            // 报错推送兜底消息
            $streamOptions->setStatus(StreamMessageStatus::Processing);
            $messageContent = new TextMessage();
            $messageContent->setStreamOptions($streamOptions);
            $messageContent->setContent(__('chat.agent.user_call_agent_fail_notice'));
            $receiveSeqDTO->setContent($messageContent);
            $chatAppService->agentSendMessage($receiveSeqDTO, $aiUserId, $receiveUserId, $appMessageId, receiverType: ConversationType::User);
        } finally {
            // 发送结束标记
            $streamOptions->setStatus(StreamMessageStatus::Completed);
            $messageContent->setContent('end');
            $messageContent->setStreamOptions($streamOptions);
            $receiveSeqDTO->setContent($messageContent);
            $chatAppService->agentSendMessage($receiveSeqDTO, $aiUserId, $receiveUserId, $appMessageId, receiverType: ConversationType::User);
        }
    }

    private function getUserIds(ReplyMessageNodeParamsConfig $paramsConfig, ExecutionData $executionData): array
    {
        $recipients = $paramsConfig->getRecipients();
        $recipientsData = $recipients?->getValue()?->getResult($executionData->getExpressionFieldData()) ?? [];

        $userIds = [];
        $departmentIds = [];
        foreach ($recipientsData as $recipient) {
            $userId = null;
            if (is_array($recipient)) {
                // 引入一个的时候
                if (isset($recipient['type'])) {
                    switch ($recipient['type']) {
                        case 'department':
                            $departmentIds[] = $recipient['id'] ?? '';
                            break;
                        default:
                            $userId = $recipient['user_id'] ?? ($recipient['id'] ?? '');
                            if (is_string($userId) && $userId !== '') {
                                $userIds[] = $userId;
                            }
                    }
                    continue;
                }
                // 引入多个的时候
                foreach ($recipient as $item) {
                    if (is_string($item)) {
                        $userIds[] = $item;
                        continue;
                    }
                    switch ($item['type'] ?? '') {
                        case 'department':
                            $departmentIds[] = $item['id'] ?? '';
                            break;
                        default:
                            $tmpUserId = $item['user_id'] ?? ($item['id'] ?? '');
                            if (is_string($tmpUserId) && $tmpUserId !== '') {
                                $userIds[] = $tmpUserId;
                            }
                    }
                }
            } elseif (is_string($recipient)) {
                $userIds[] = $recipient;
            }
        }
        if (! empty($departmentIds)) {
            $userIds = array_merge($userIds, $this->getUserIdsByDepartmentIds($executionData, $departmentIds));
        }

        // 如果为空，兜底当前用户
        if (empty($userIds)) {
            $userIds[] = $executionData->getOperator()->getUid();
        }

        // 过滤不合法的用户
        $userIds = array_values(array_unique($userIds));

        return Db::table('magic_contact_users')
            ->whereIn('user_id', $userIds)
            ->pluck('user_id')->toArray();
    }

    private function getUserIdsByDepartmentIds(ExecutionData $executionData, array $departmentIds): array
    {
        // 先粗糙的直连 Db
        $allDepartments = Db::table('magic_contact_departments')
            ->select(['department_id', 'parent_department_id', 'name', 'path'])
            ->where('organization_code', '=', $executionData->getDataIsolation()->getCurrentOrganizationCode())
            ->get()->keyBy('department_id')->toArray();
        $list = [];

        foreach ($allDepartments as $department) {
            foreach ($departmentIds as $departmentId) {
                if (! $departmentInfo = $allDepartments[$departmentId] ?? null) {
                    continue;
                }
                if (str_starts_with($department['path'], $departmentInfo['path'])) {
                    $list[] = $department['department_id'];
                }
            }
        }

        return Db::table('magic_contact_department_users')
            ->whereIn('department_id', $list)
            ->pluck('user_id')->toArray();
    }
}
