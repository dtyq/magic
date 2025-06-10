<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Application\Chat\Event\Publish\RecordingSummaryEndPublisher;
use App\Domain\Chat\DTO\Message\ChatMessage\AbstractAttachmentMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\Item\ChatAttachment;
use App\Domain\Chat\DTO\Message\ChatMessage\RecordingSummaryMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\RecordingSummaryStreamMessage;
use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\Chat\DTO\Request\Common\MagicContext;
use App\Domain\Chat\DTO\Request\StreamRequest;
use App\Domain\Chat\Entity\Items\SeqExtra;
use App\Domain\Chat\Entity\MagicChatFileEntity;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationStatus;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\FileType;
use App\Domain\Chat\Entity\ValueObject\MagicMessageStatus;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\RecordingSummaryStatus;
use App\Domain\Chat\Event\Seq\RecordingSummaryEndEvent;
use App\Domain\Chat\Service\MagicChatDomainService;
use App\Domain\Chat\Service\MagicChatFileDomainService;
use App\Domain\Chat\Service\MagicRecordingSummaryDomainService;
use App\Domain\Chat\Service\MagicSeqDomainService;
use App\Domain\Chat\Service\MagicTopicDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Service\FileDomainService;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Asr\AsrFacade;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Infrastructure\Util\File\FMTChunk;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Hyperf\Amqp\Producer;
use Hyperf\Codec\Json;
use Hyperf\Context\ApplicationContext;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Hyperf\WebSocketServer\Context as WebSocketContext;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

/**
 * 聊天消息相关.
 */
class MagicRecordingSummaryAppService extends MagicSeqAppService
{
    public function __construct(
        protected LoggerInterface $logger,
        protected readonly MagicChatDomainService $magicChatDomainService,
        protected readonly MagicTopicDomainService $magicTopicDomainService,
        protected readonly MagicChatFileDomainService $magicChatFileDomainService,
        protected MagicSeqDomainService $magicSeqDomainService,
        protected FileDomainService $fileDomainService,
        protected MagicRecordingSummaryDomainService $magicStreamDomainService,
        protected Producer $producer,
    ) {
        try {
            $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get(get_class($this));
        } catch (Throwable) {
        }
        parent::__construct($magicSeqDomainService);
    }

    /**
     * @throws Throwable
     */
    public function onStreamMessage(StreamRequest $streamRequest, MagicUserAuthorization $userAuthorization): array
    {
        $conversationEntity = $this->magicChatDomainService->getConversationById($streamRequest->getData()->getConversationId());
        if ($conversationEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        $seqDTO = new MagicSeqEntity($streamRequest->getData()->getMessage()->toArray());
        $seqDTO->setReferMessageId($streamRequest->getData()->getReferMessageId());
        $seqDTO->setOrganizationCode($userAuthorization->getOrganizationCode());
        $seqDTO->setConversationId($conversationEntity->getId());
        $seqDTO->setObjectId($userAuthorization->getMagicId());
        $topicId = (string) $streamRequest->getData()->getMessage()?->getTopicId();
        if ($topicId) {
            // seq 的扩展信息. 如果需要检索话题的消息,请查询 topic_messages 表
            $seqExtra = new SeqExtra();
            $seqExtra->setTopicId($topicId);
            $seqDTO->setExtra($seqExtra);
        }
        // 如果是跟 ai 的私聊，且没有话题 id，自动创建一个话题
        if ($conversationEntity->getReceiveType() === ConversationType::Ai && empty($seqDTO->getExtra()?->getTopicId())) {
            $topicId = $this->magicTopicDomainService->agentSendMessageGetTopicId($conversationEntity, 0);
            // 不影响原有逻辑，将 topicId 设置到 extra 中
            $seqExtra = $seqDTO->getExtra() ?? new SeqExtra();
            $seqExtra->setTopicId($topicId);
            $seqDTO->setExtra($seqExtra);
        }
        $senderUserEntity = $this->magicChatDomainService->getUserInfo($conversationEntity->getUserId());
        $messageDTO = MessageAssembler::getStreamMessageDTOByRequest(
            $streamRequest,
            $conversationEntity,
            $senderUserEntity
        );
        return $this->dispatchMessage($seqDTO, $messageDTO, $userAuthorization, $conversationEntity);
    }

    /**
     * 消息鉴权.
     */
    public function checkSendMessageAuth(MagicConversationEntity $conversationEntity, DataIsolation $dataIsolation): void
    {
        // 检查会话 id所属组织，与当前传入组织编码的一致性
        if ($conversationEntity->getUserOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        // 判断会话的发起者是否是当前用户
        if ($conversationEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        // 会话是否已被删除
        if ($conversationEntity->getStatus() === ConversationStatus::Delete) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_DELETED);
        }
        // todo 检查是否有发消息的权限(需要有好友关系，企业关系，集团关系，合作伙伴关系等)
    }

    /**
     * 开发阶段,前端对接有时间差,上下文兼容性处理.
     */
    public function setUserContext(string $userToken, ?MagicContext $magicContext): void
    {
        if (! $magicContext) {
            ExceptionBuilder::throw(ChatErrorCode::CONTEXT_LOST);
        }
        // 为了支持一个ws链接收发多个账号的消息,允许在消息上下文中传入账号 token
        if (! $magicContext->getAuthorization()) {
            $magicContext->setAuthorization($userToken);
        }
        // 协程上下文中设置用户信息,供 WebsocketChatUserGuard 使用
        WebSocketContext::set(MagicContext::class, $magicContext);
    }

    public function recordingSummary(
        DataIsolation $dataIsolation,
        MagicSeqEntity $magicSeqEntity,
        MagicMessageEntity $magicMessageEntity,
        MagicConversationEntity $conversationEntity,
        RecordingSummaryStreamMessage $streamMessage
    ): bool {
        $magicSeqEntity->setStatus(MagicMessageStatus::Read);
        $magicSeqEntity->setSeqType(ChatMessageType::RecordingSummary);
        /** @var RecordingSummaryMessage $message */
        $message = $magicMessageEntity->getContent();
        $recordingStatus = $message->getStatus();
        $result = match ($recordingStatus) {
            RecordingSummaryStatus::Start => $this->getSummaryStart($dataIsolation, $magicMessageEntity, $message),
            RecordingSummaryStatus::Recording => $this->getRecording($dataIsolation, $magicMessageEntity, $message, $streamMessage),
            RecordingSummaryStatus::End => $this->getSummaryEnd($dataIsolation, $magicSeqEntity, $magicMessageEntity, $conversationEntity, $message),
            default => null
        };
        $magicMessageEntity->setContent($message);
        $magicSeqEntity->setSeqType(ChatMessageType::RecordingSummary);
        return $result;
    }

    public function dispatchByMessageType(
        DataIsolation $dataIsolation,
        MagicSeqEntity $magicSeqEntity,
        MagicMessageEntity $magicMessageEntity,
        MagicConversationEntity $conversationEntity
    ): array {
        $messageType = $magicMessageEntity->getMessageType();
        $streamMessage = $this->getStreamMessageByAppMessageId($magicMessageEntity->getAppMessageId());
        if (! $streamMessage) {
            $streamMessage = new RecordingSummaryStreamMessage();
            $streamMessage->setType($magicMessageEntity->getMessageType());
            $streamMessage->setAppMessageId($magicMessageEntity->getAppMessageId());
            $streamMessage->setContent([]);
            $this->magicStreamDomainService->createStreamMessage($dataIsolation, $streamMessage);
            $streamMessage = $this->getStreamMessageByAppMessageId($magicMessageEntity->getAppMessageId());
        }

        $isReturn = match ($messageType) {
            ChatMessageType::RecordingSummary => $this->recordingSummary($dataIsolation, $magicSeqEntity, $magicMessageEntity, $conversationEntity, $streamMessage),
            default => ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR),
        };

        // 生成序列消息
        if ($isReturn) {
            try {
                Db::beginTransaction();
                $magicMessageEntity = $this->magicChatDomainService->createMagicMessageByAppClient($magicMessageEntity, $conversationEntity);
                $magicSeqEntity = $this->magicChatDomainService->generateSenderSequenceByChatMessage(
                    $magicSeqEntity,
                    $magicMessageEntity,
                    $conversationEntity
                );
                // 将seqId添加到streamMessage中,用于清理无效的消息
                $streamMessage->addSeqId($magicSeqEntity->getSeqId());
                $this->updateStreamMessage($dataIsolation, $streamMessage);
                Db::commit();
                SocketIOUtil::sendSequenceId($magicSeqEntity);
            } catch (Throwable $exception) {
                Db::rollBack();
                $this->logger->error(Json::encode([
                    'file' => $exception->getFile(),
                    'line' => $exception->getLine(),
                    'message' => $exception->getMessage(),
                    'trace' => $exception->getTraceAsString(),
                ]));
                throw $exception;
            }
        }
        return SeqAssembler::getClientSeqStruct($magicSeqEntity, $magicMessageEntity)->toArray();
    }

    /**
     * 校验附件中的文件是否属于当前用户,并填充附件信息.（文件名/类型等字段）.
     */
    public function checkAndFillAttachments(MagicMessageEntity $senderMessageDTO, DataIsolation $dataIsolation): MagicMessageEntity
    {
        $content = $senderMessageDTO->getContent();
        if (! $content instanceof AbstractAttachmentMessage) {
            return $senderMessageDTO;
        }
        $attachments = $content->getAttachments();
        if (empty($attachments)) {
            return $senderMessageDTO;
        }
        $attachments = $this->magicChatFileDomainService->checkAndFillAttachments($attachments, $dataIsolation);
        $content->setAttachments($attachments);
        return $senderMessageDTO;
    }

    /**
     * @param RecordingSummaryMessage $message
     */
    public function getSummaryStart(
        DataIsolation $dataIsolation,
        MagicMessageEntity $magicMessageEntity,
        MessageInterface $message
    ): bool {
        //        $streamMessage = new StreamMessageEntity();
        //        $streamMessage->setType(ChatMessageType::RecordingSummary);
        //        $streamMessage->setAppMessageId($magicMessageEntity->getAppMessageId());
        //        $streamMessage->setContent($message->toArray());
        $message->setStatus(RecordingSummaryStatus::Recording);
        //        $this->magicStreamDomainService->createStreamMessage($dataIsolation, $streamMessage);
        return true;
    }

    /**
     * @param RecordingSummaryMessage $message
     */
    public function getRecording(DataIsolation $dataIsolation, MagicMessageEntity $magicMessageEntity, MessageInterface $message, RecordingSummaryStreamMessage $streamMessage): bool
    {
        try {
            // 将音频数据识别后，返回给用户
            $audio = $message->getRecordingBlob();
            // 先base64解码/再解压
            $audio = base64_decode($audio);
            /* @phpstan-ignore-next-line */
            if ($audio === false) {
                return false;
            }
            $audio = gzdecode($audio);
            if ($audio === false) {
                return false;
            }

            $tempKey = $streamMessage->getContent()['temp_audio_key'] ?? '';
            if (! $tempKey) {
                $tempPath = $this->getTempPath($magicMessageEntity);
                $tempKey = $tempPath . '/' . IdGenerator::getSnowId() . '.wav';
                EasyFileTools::saveFile($tempKey, $audio);
            } else {
                $this->getTempPath($magicMessageEntity);
                EasyFileTools::mergeWavFiles($tempKey, $audio);
            }
            if ($message->getIsRecognize()) {
                $fullText = $streamMessage->getContent()['full_text'] ?? '';
                $text = AsrFacade::recognize($tempKey, params: ['context' => [
                    'context_type' => 'dialog_ctx',
                    'context_data' => [
                        [
                            'text' => $fullText,
                        ],
                    ],
                ]]);
                $message->setText($text['text']);
                $message->setFullText($fullText . $text['text']);
                $message->setTempAudioKey('');
            } else {
                $message->setTempAudioKey($tempKey);
            }

            // 将文件写入到path中
            $audioKey = $this->saveAudio($audio, $this->getAudioSavePath($magicMessageEntity), $streamMessage);
            if (! empty($audioKey)) {
                $attachment = new ChatAttachment([
                    'file_type' => FileType::Audio->value,
                    'file_name' => $audioKey,
                    'file_extension' => 'wav',
                ]);
                $magicChatFileEntity = new MagicChatFileEntity();
                $magicChatFileEntity->setFileType(FileType::Audio);
                $magicChatFileEntity->setFileKey($audioKey);
                $magicChatFileEntity->setFileName($audioKey);
                $magicChatFileEntity->setFileExtension('wav');
                $magicChatFileEntity->setFileSize($streamMessage->getContent()['last_audio_format']['file_size'] ?? 0);
                $fileUploadDTOs = [$magicChatFileEntity];
                $magicChatFileEntities = $this->magicChatFileDomainService->fileUpload($fileUploadDTOs, $dataIsolation);
                $attachment->setFileId($magicChatFileEntities[0]->getFileId());
                $message->setAttachments([$attachment]);
                $message->setLastAudioKey($audioKey);
            }

            // 保存流式消息
            $content = $streamMessage->getContent();
            if ($message->getIsRecognize()) {
                $content['temp_audio_key'] = '';
            }
            $message->setRecordingBlob('');
            $messageData = $message->toArray();
            foreach ($messageData as $key => $value) {
                if ($key === 'attachments') {
                    $content['attachments'] = array_merge($content['attachments'] ?? [], $value);
                }
                // 只保存有值的字段（避免覆盖）
                if ($value) {
                    $content[$key] = $value;
                }
            }
            $streamMessage->setContent($content);
            return true;
        } catch (Throwable $exception) {
            $this->logger->error(Json::encode([
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'message' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]));
            return false;
        } finally {
            $message->setRecordingBlob('');
            // 清理audio文件
            //            $audioPath = $this->getTempPath($magicMessageEntity->getAppMessageId());
            //            FileSystem::remove($audioPath);
        }
    }

    /**
     * @param RecordingSummaryMessage $message
     */
    public function getSummaryEnd(
        DataIsolation $dataIsolation,
        MagicSeqEntity $magicSeqEntity,
        MagicMessageEntity $magicMessageEntity,
        MagicConversationEntity $conversationEntity,
        MessageInterface $message,
    ) {
        // 录音结束
        $message->setStatus(RecordingSummaryStatus::Summary);
        $message->setRecordingBlob('');
        $magicSeqEntity->setContent($message);
        $conversationEntity->setReceiveType(ConversationType::User);

        // 投递消息
        $sequenceData = [
            'magic_seq_entity' => $magicSeqEntity->toArray(),
            'magic_message_entity' => $magicMessageEntity->toArray(),
            'conversation_entity' => $conversationEntity->toArray(),
            'data_isolation' => $dataIsolation->toArray(),
            'message' => $message->toArray(),
        ];
        $streamMessage = $this->getStreamMessageByAppMessageId($magicMessageEntity->getAppMessageId());
        if ($streamMessage) {
            $streamMessage->setSequenceContent($sequenceData);
            $this->updateStreamMessage($dataIsolation, $streamMessage);
        }
        $event = new RecordingSummaryEndEvent($streamMessage->getAppMessageId());
        $this->producer->produce(new RecordingSummaryEndPublisher($event));
        return true;
    }

    public function saveAudio(string $audio, string $path, RecordingSummaryStreamMessage $streamMessageEntity): ?string
    {
        $result = '';
        if (! is_dir($path)) {
            if (! mkdir($path, 0777, true) && ! is_dir($path)) {
                throw new RuntimeException(sprintf('Directory "%s" was not created', $path));
            }
        }

        $lastAudioKey = $streamMessageEntity->getContent()['last_audio_key'] ?? '';
        if (! $lastAudioKey) {
            $audioKey = $path . '/' . IdGenerator::getSnowId() . '.wav';
            EasyFileTools::saveFile($audioKey, $audio);
            $result = $audioKey;
        } else {
            if ($this->checkMerge($lastAudioKey, $audio)) {
                EasyFileTools::mergeWavFiles($lastAudioKey, $audio);
            } else {
                // 另起新文件
                $audioKey = $path . '/' . IdGenerator::getSnowId() . '.wav';
                EasyFileTools::saveFile($audioKey, $audio);
                $result = $audioKey;
            }
        }
        $this->logger->info('save audio file', ['audioKey' => $result, 'path' => $path, json_encode($streamMessageEntity->getContent(), JSON_UNESCAPED_UNICODE)]);
        return $result;
    }

    /**
     * 根据客户端发来的聊天消息类型,分发到对应的处理模块.
     * @throws Throwable
     */
    public function dispatchMessage(
        MagicSeqEntity $magicSeqEntity,
        MagicMessageEntity $magicMessageEntity,
        MagicUserAuthorization $userAuthorization,
        MagicConversationEntity $senderConversationEntity
    ): array {
        $chatMessageType = $magicMessageEntity->getMessageType();
        // todo 后续看看要不要增加一个streamMessage的类型
        if (! $chatMessageType instanceof ChatMessageType) {
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR);
        }
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        // 消息鉴权
        $this->checkSendMessageAuth($senderConversationEntity, $dataIsolation);
        // 安全性保证，校验附件中的文件是否属于当前用户
        $magicMessageEntity = $this->checkAndFillAttachments($magicMessageEntity, $dataIsolation);
        return $this->dispatchByMessageType($dataIsolation, $magicSeqEntity, $magicMessageEntity, $senderConversationEntity);
    }

    public function updateStreamMessage(DataIsolation $dataIsolation, $streamMessage): void
    {
        $this->magicStreamDomainService->updateStreamMessage($dataIsolation, $streamMessage);
    }

    public function getStreamMessageByAppMessageId(string $getAppMessageId): ?RecordingSummaryStreamMessage
    {
        return $this->magicStreamDomainService->getStreamMessageByAppMessageId($getAppMessageId);
    }

    public function getAudioSavePath(MagicMessageEntity $magicMessageEntity): string
    {
        $path = sprintf(
            '%s/%s/%s/%s/%s',
            config('cloud-file.tos_local_mount_path'),
            $magicMessageEntity->getSenderOrganizationCode(),
            config('kk_brd_service.app_id'),
            $magicMessageEntity->getSenderId(),
            $magicMessageEntity->getAppMessageId()
        );
        if (! is_dir($path)) {
            if (! mkdir($path, 0777, true) && ! is_dir($path)) {
                throw new RuntimeException(sprintf('Directory "%s" was not created', $path));
            }
        }

        return $path;
    }

    public function getTempPath(MagicMessageEntity $magicMessageEntity): string
    {
        $path = sprintf(
            '%s/%s/%s/temp/%s/%s',
            config('cloud-file.tos_local_mount_path'),
            $magicMessageEntity->getSenderOrganizationCode(),
            config('kk_brd_service.app_id'),
            $magicMessageEntity->getSenderId(),
            $magicMessageEntity->getAppMessageId()
        );
        if (! is_dir($path)) {
            if (! mkdir($path, 0777, true) && ! is_dir($path)) {
                throw new RuntimeException(sprintf('Directory "%s" was not created', $path));
            }
        }

        return $path;
    }

    private function checkMerge(string $audioKey, string $tempAudioKey): bool
    {
        return true;
        // /** @var FMTChunk $format1 */
        // $format1 = EasyFileTools::getAudioFormat($audioKey);
        // $format2 = EasyFileTools::getAudioFormat($tempAudioKey);
        //
        // $result = true;
        // if ($format1->audioFormat !== $format2->audioFormat) {
        //    $result = false;
        // }
        // if ($format1->numChannels !== $format2->numChannels) {
        //    $result = false;
        // }
        // if ($format1->sampleRate !== $format2->sampleRate) {
        //    $result = false;
        // }
        // if ($format1->bitsPerSample !== $format2->bitsPerSample) {
        //    $result = false;
        // }
        //
        // // todo 文件太大也另存为新文件
        // return $result;
    }
}
