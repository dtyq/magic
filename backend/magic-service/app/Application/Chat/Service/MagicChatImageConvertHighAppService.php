<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\Chat\DTO\ImageConvertHigh\Request\MagicChatImageConvertHighReqDTO;
use App\Domain\Chat\DTO\Message\ChatMessage\AIImageCardMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\ImageConvertHighCardMessage;
use App\Domain\Chat\Entity\Items\SeqExtra;
use App\Domain\Chat\Entity\MagicChatFileEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\AIImage\Radio;
use App\Domain\Chat\Entity\ValueObject\FileType;
use App\Domain\Chat\Entity\ValueObject\ImageConvertHigh\ImageConvertHighResponseType;
use App\Domain\Chat\Service\MagicAIImageDomainService;
use App\Domain\Chat\Service\MagicChatDomainService;
use App\Domain\Chat\Service\MagicChatFileDomainService;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\SSRF\Exception\SSRFException;
use App\Infrastructure\Util\SSRF\SSRFUtil;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Hyperf\Snowflake\IdGeneratorInterface;
use JetBrains\PhpStorm\ArrayShape;
use Psr\Log\LoggerInterface;
use ReflectionEnum;
use Throwable;

use function di;
use function Hyperf\Translation\__;
use function mb_strlen;

/**
 * AI文生图.
 */
class MagicChatImageConvertHighAppService extends AbstractAIImageAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected readonly MagicConversationDomainService $magicConversationDomainService,
        protected readonly MagicUserDomainService $magicUserDomainService,
        protected readonly MagicChatDomainService $magicChatDomainService,
        protected readonly MagicAIImageDomainService $magicAIImageDomainService,
        protected readonly FileDomainService $fileDomainService,
        protected readonly MagicChatFileDomainService $magicChatFileDomainService,
        protected readonly AdminProviderDomainService $serviceProviderDomainService,
        protected readonly LLMAppService $llmAppService,
        protected readonly Redis $redis,
        protected IdGeneratorInterface $idGenerator,
    ) {
        $this->logger = di()->get(LoggerFactory::class)->get(get_class($this));
    }

    /**
     * @throws SSRFException
     */
    public function handleUserMessage(RequestContext $requestContext, MagicChatImageConvertHighReqDTO $reqDTO): void
    {
        $referContent = $this->getReferContentForAIImage($reqDTO->getReferMessageId());
        if ($referContent instanceof AIImageCardMessage || $referContent instanceof ImageConvertHighCardMessage) {
            $reqDTO->setRadio($referContent->getRadio() ?? Radio::OneToOne->value);
        }
        $referText = $this->getReferTextByContentForAIImage($referContent);
        $reqDTO->setReferText($referText);
        $dataIsolation = $this->createDataIsolation($requestContext->getUserAuthorization());
        $requestContext->setDataIsolation($dataIsolation);
        $reqDTO->setAppMessageId((string) $this->idGenerator->generate());

        $url = SSRFUtil::getSafeUrl($reqDTO->getOriginImageUrl(), replaceIp: false);
        $reqDTO->setOriginImageUrl($url);
        $authorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($authorization);
        $requestContext->setDataIsolation($dataIsolation);
        try {
            $taskId = $this->llmAppService->imageConvertHigh($authorization, $reqDTO);
            $this->aiSendMessage(
                $reqDTO->getConversationId(),
                (string) $this->idGenerator->generate(),
                ImageConvertHighResponseType::START_GENERATE,
                [
                    'origin_file_id' => $reqDTO->getOriginImageId() ?? null,
                    'radio' => $reqDTO->getRadio(),
                ],
                $reqDTO->getAppMessageId(),
                $reqDTO->getTopicId(),
                $reqDTO->getReferMessageId(),
            );
            // 计时开始
            $start = microtime(true);
            // 轮询600次，直到拿到图片
            $count = 600;
            $response = null;

            while ($count-- > 0) {
                $response = $this->llmAppService->imageConvertHighQuery($authorization, $taskId);
                if ($response->isFinishStatus() === true) {
                    break;
                }
                sleep(2);
            }
            // 如果未完成，则报错超时
            if (! $response?->isFinishStatus() || empty($response?->getUrls())) {
                ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, 'image_generate.task_timeout');
            }
            // 计时结束，输出秒级时间
            $end = microtime(true);
            $this->logger->info(sprintf('转高清结束，耗时: %s秒。', $end - $start));
            // 将新旧图片存入附件
            $newFile = $this->upLoadFiles($requestContext, [$response->getUrls()[0]])[0] ?? [];
            $this->aiSendMessage(
                $reqDTO->getConversationId(),
                (string) $this->idGenerator->generate(),
                ImageConvertHighResponseType::GENERATED,
                [
                    'origin_file_id' => $reqDTO->getOriginImageId() ?? null,
                    'new_file_id' => $newFile['file_id'] ?? null,
                    'refer_text' => $reqDTO->getReferText(),
                    'radio' => $reqDTO->getRadio(),
                ],
                $reqDTO->getAppMessageId(),
                $reqDTO->getTopicId(),
                $reqDTO->getReferMessageId(),
            );
        } catch (Throwable $e) {
            // 发生异常时，发送终止消息，并抛出异常
            $this->handleGlobalThrowable($reqDTO, $e);
        }
    }

    /**
     * 将文件上传到云端.
     */
    #[ArrayShape([['file_id' => 'string', 'url' => 'string']])]
    private function upLoadFiles(RequestContext $requestContext, array $attachments): array
    {
        $images = [];
        foreach ($attachments as $attachment) {
            if (! is_string($attachment)) {
                continue;
            }
            try {
                // 上传OSS
                $uploadFile = new UploadFile($attachment);
                $this->fileDomainService->uploadByCredential($requestContext->getUserAuthorization()->getOrganizationCode(), $uploadFile);
                // 获取url
                $url = $this->fileDomainService->getLink($requestContext->getUserAuthorization()->getOrganizationCode(), $uploadFile->getKey())->getUrl();
                // 同步文件至magic
                $fileUploadDTOs = [];
                $fileType = FileType::getTypeFromFileExtension($uploadFile->getExt());
                $fileUploadDTO = new MagicChatFileEntity();
                $fileUploadDTO->setFileKey($uploadFile->getKey());
                $fileUploadDTO->setFileSize($uploadFile->getSize());
                $fileUploadDTO->setFileExtension($uploadFile->getExt());
                $fileUploadDTO->setFileName($uploadFile->getName());
                $fileUploadDTO->setFileType($fileType);
                $fileUploadDTOs[] = $fileUploadDTO;
                $magicChatFileEntity = $this->magicChatFileDomainService->fileUpload($fileUploadDTOs, $requestContext->getDataIsolation())[0] ?? null;
                $images[] = [
                    'file_id' => $magicChatFileEntity->getFileId(),
                    'url' => $url,
                ];
            } catch (Throwable $throwable) {
                // 提交图片失败
                $this->logger->error('upload_attachment_error', [
                    'error' => $throwable->getMessage(),
                    'file' => $attachment,
                ]);
            }
        }
        return $images;
    }

    private function handleGlobalThrowable(MagicChatImageConvertHighReqDTO $reqDTO, Throwable $e)
    {
        $errorCode = $e->getCode();
        $errorMessage = __('chat.agent.user_call_agent_fail_notice');
        $errorCode = ImageGenerateErrorCode::tryFrom($errorCode);
        if ($errorCode instanceof ImageGenerateErrorCode) {
            $errorMessage = $this->getErrorMessageFromImageGenerateErrorCode($errorCode) . $e->getMessage();
        }
        $this->aiSendMessage(
            $reqDTO->getConversationId(),
            (string) $this->idGenerator->generate(),
            ImageConvertHighResponseType::TERMINATE,
            [
                'error_message' => $errorMessage,
                'origin_file_id' => $reqDTO->getOriginImageId() ?? null,
            ],
            $reqDTO->getAppMessageId(),
            $reqDTO->getTopicId(),
            $reqDTO->getReferMessageId(),
        );
        $errMsg = [
            'function' => 'imageConvertHighError',
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'message' => $errorMessage,
            'trace' => $e->getTraceAsString(),
        ];
        $this->logger->error('imageConvertHighError ' . Json::encode($errMsg, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        //        throw $e;
    }

    private function getErrorMessageFromImageGenerateErrorCode(ImageGenerateErrorCode $case): ?string
    {
        // 获取枚举常量的反射对象
        $reflectionEnum = new ReflectionEnum($case);
        $reflectionCase = $reflectionEnum->getCase($case->name);

        // 获取常量的所有注解
        $attributes = $reflectionCase->getAttributes(ErrorMessage::class);

        // 检查是否存在 ErrorMessage 注解
        if (! empty($attributes)) {
            // 实例化注解对象
            $errorMessageAttribute = $attributes[0]->newInstance();

            // 返回注解中的 message 属性
            return '[' . __($errorMessageAttribute->getMessage()) . ']';
        }

        return null;
    }

    private function aiSendMessage(
        string $conversationId,
        ?string $id,
        ImageConvertHighResponseType $type,
        array $content,
        // 流式响应，拿到客户端传来的 app_message_id ，作为响应时候的唯一标识
        string $appMessageId = '',
        string $topicId = '',
        string $referMessageId = '',
    ): array {
        $logMessageContent = Json::encode($content, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (mb_strlen($logMessageContent) > 300) {
            $logMessageContent = '';
        }
        $this->logger->info(sprintf(
            'imageConvertHighSendMessage conversationId:%s id:%s messageName:%s Type:%s appMessageId:%s topicId:%s logMessageContent:%s',
            $conversationId,
            $id,
            ImageConvertHighResponseType::getNameFromType($type),
            $type->value,
            $appMessageId,
            $topicId,
            $logMessageContent
        ));
        $content = $content + [
            'id' => $id ?? (string) $this->idGenerator->generate(),
            'type' => $type,
        ];
        $messageInterface = new ImageConvertHighCardMessage($content);
        $extra = new SeqExtra();
        $extra->setTopicId($topicId);
        $seqDTO = (new MagicSeqEntity())
            ->setConversationId($conversationId)
            ->setContent($messageInterface)
            ->setSeqType($messageInterface->getMessageTypeEnum())
            ->setAppMessageId($appMessageId)
            ->setReferMessageId($referMessageId)
            ->setExtra($extra);
        // 设置话题 id
        return $this->getMagicChatMessageAppService()->aiSendMessage($seqDTO, $appMessageId, doNotParseReferMessageId: true);
    }

    private function getMagicChatMessageAppService(): MagicChatMessageAppService
    {
        return di(MagicChatMessageAppService::class);
    }
}
