<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service\ThirdPlatformChat\FeiShuRobot;

use App\Application\Agent\Service\ThirdPlatformChat\FeiShuRobot\FeiShu\Application;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformChatEvent;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformChatInterface;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformChatMessage;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformCreateGroup;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformCreateSceneGroup;
use App\Application\Flow\ExecuteManager\Attachment\Attachment;
use App\Application\Flow\ExecuteManager\Attachment\LocalAttachment;
use App\Application\Flow\ExecuteManager\ExecutionData\TriggerDataUserExtInfo;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Infrastructure\Util\Locker\LockerInterface;
use Exception;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use JsonException;
use Nyholm\Psr7\Response;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;

class FeiShuRobotChat implements ThirdPlatformChatInterface
{
    /**
     * 飞书消息类型常量.
     */
    private const string MESSAGE_TYPE_TEXT = 'text';

    private const string MESSAGE_TYPE_IMAGE = 'image';

    private const string MESSAGE_TYPE_FILE = 'file';

    private const string MESSAGE_TYPE_POST = 'post';

    /**
     * 飞书聊天类型常量.
     */
    private const string CHAT_TYPE_P2P = 'p2p';

    private const string CHAT_TYPE_GROUP = 'group';

    /**
     * 飞书事件类型常量.
     */
    private const string EVENT_TYPE_MESSAGE_RECEIVE = 'im.message.receive_v1';

    /**
     * 锁定前缀
     */
    private const string LOCK_PREFIX = 'feishu_message_';

    /**
     * 锁定时间 (秒).
     */
    private const int LOCK_TTL = 7200;

    /**
     * 图片默认尺寸.
     */
    private const int DEFAULT_IMAGE_WIDTH = 300;

    private const int DEFAULT_IMAGE_HEIGHT = 300;

    /**
     * 飞书应用实例.
     */
    private Application $application;

    /**
     * 日志记录器.
     */
    private LoggerInterface $logger;

    /**
     * 锁定器.
     */
    private LockerInterface $locker;

    private CacheInterface $cache;

    /**
     * 构造函数.
     *
     * @param array $options 飞书配置选项
     * @throws Exception 如果配置无效
     */
    public function __construct(array $options)
    {
        if (empty($options)) {
            throw new InvalidArgumentException('飞书机器人配置不能为空');
        }
        $options['http'] = [
            'base_uri' => 'https://open.feishu.cn',
        ];
        $this->logger = di(LoggerFactory::class)->get('FeiShuRobotChat');
        $this->locker = di(LockerInterface::class);
        $this->cache = di(CacheInterface::class);
        $this->application = new Application($options);
    }

    /**
     * 解析聊天参数.
     *
     * @param array $params 接收到的参数
     * @return ThirdPlatformChatMessage 解析后的消息对象
     */
    public function parseChatParam(array $params): ThirdPlatformChatMessage
    {
        $chatMessage = new ThirdPlatformChatMessage();

        // 处理服务器验证请求
        if (isset($params['challenge'])) {
            return $this->handleChallengeCheck($params, $chatMessage);
        }

        // 检查消息参数是否有效
        if (empty($params['event']) || empty($params['header'])) {
            $this->logger->warning('飞书消息参数无效', ['params' => $params]);
            $chatMessage->setEvent(ThirdPlatformChatEvent::None);
            return $chatMessage;
        }

        $messageId = $params['event']['message']['message_id'] ?? '';

        // 幂等性处理：使用消息ID进行去重
        if (! $this->checkMessageIdLock($messageId)) {
            $this->logger->info('飞书消息已处理过，跳过', ['message_id' => $messageId]);
            $chatMessage->setEvent(ThirdPlatformChatEvent::None);
            return $chatMessage;
        }

        $eventType = $params['header']['event_type'] ?? '';
        if ($eventType === self::EVENT_TYPE_MESSAGE_RECEIVE) {
            return $this->handleMessageReceive($params, $chatMessage);
        }

        $this->logger->info('未知的飞书事件类型', ['event_type' => $eventType]);
        return $chatMessage;
    }

    /**
     * 发送消息.
     *
     * @param ThirdPlatformChatMessage $thirdPlatformChatMessage 平台消息
     * @param MessageInterface $message 要发送的消息
     */
    public function sendMessage(ThirdPlatformChatMessage $thirdPlatformChatMessage, MessageInterface $message): void
    {
        // 验证消息类型
        if (! $message instanceof TextMessage) {
            $this->logger->warning('不支持的消息类型', ['message_type' => get_class($message)]);
            return;
        }

        // 验证会话类型
        if (! $thirdPlatformChatMessage->isOne() && ! $thirdPlatformChatMessage->isGroup()) {
            $this->logger->warning('不支持的会话类型', ['conversation_type' => $thirdPlatformChatMessage->getType()]);
            return;
        }

        try {
            $content = $message->getContent();
            // 解析 Markdown 内容，转换为飞书富文本格式
            $postContent = $this->parseMarkdownToFeiShuPost($content);
            $data = [
                'receive_id' => $thirdPlatformChatMessage->getOriginConversationId(),
                'msg_type' => 'post',
                'content' => [
                    'zh_cn' => $postContent,
                ],
            ];

            $this->logger->info('SendMessageToFeiShu', [
                'receive_id' => $thirdPlatformChatMessage->getOriginConversationId(),
                'content_length' => strlen($content),
            ]);

            $this->application->message->send($data, 'chat_id');
        } catch (Exception $e) {
            $this->logger->error('发送飞书消息失败', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'receive_id' => $thirdPlatformChatMessage->getOriginConversationId(),
            ]);
        }
    }

    public function getThirdPlatformUserIdByMobiles(string $mobile): string
    {
        return '';
    }

    public function createSceneGroup(ThirdPlatformCreateSceneGroup $params): string
    {
        return '';
    }

    public function createGroup(ThirdPlatformCreateGroup $params): string
    {
        return '';
    }

    /**
     * 处理服务器验证请求
     *
     * @param array $params 请求参数
     * @param ThirdPlatformChatMessage $chatMessage 聊天消息对象
     * @return ThirdPlatformChatMessage 处理后的消息对象
     */
    private function handleChallengeCheck(array $params, ThirdPlatformChatMessage $chatMessage): ThirdPlatformChatMessage
    {
        $this->logger->info('处理飞书服务器验证请求');

        $chatMessage->setEvent(ThirdPlatformChatEvent::CheckServer);
        $response = new Response(
            200,
            ['Content-Type' => 'application/json'],
            json_encode(['challenge' => $params['challenge']], JSON_UNESCAPED_UNICODE)
        );
        $chatMessage->setResponse($response);

        return $chatMessage;
    }

    /**
     * 检查消息ID锁
     *
     * @param string $messageId 消息ID
     * @return bool 是否成功锁定
     */
    private function checkMessageIdLock(string $messageId): bool
    {
        if (empty($messageId)) {
            $this->logger->warning('消息ID为空，无法锁定');
            return false;
        }

        $lockKey = self::LOCK_PREFIX . $messageId;
        return $this->locker->mutexLock($lockKey, 'feishu', self::LOCK_TTL);
    }

    /**
     * 处理接收到的消息.
     *
     * @param array $params 请求参数
     * @param ThirdPlatformChatMessage $chatMessage 聊天消息对象
     * @return ThirdPlatformChatMessage 处理后的消息对象
     */
    private function handleMessageReceive(array $params, ThirdPlatformChatMessage $chatMessage): ThirdPlatformChatMessage
    {
        $chatMessage->setEvent(ThirdPlatformChatEvent::ChatMessage);
        $messageId = $params['event']['message']['message_id'] ?? '';
        $organizationCode = $params['magic_system']['organization_code'] ?? '';

        // 设置基本信息
        $this->setMessageBasicInfo($params, $chatMessage);

        // 处理消息内容
        $content = $this->decodeMessageContent($params['event']['message']['content'] ?? '');
        $messageType = $params['event']['message']['message_type'] ?? '';

        $result = $this->processMessageContent($messageType, $content, $chatMessage, $organizationCode, $messageId);

        if ($result === false) {
            // 不支持的消息类型，已发送提示并设置事件为None
            return $chatMessage;
        }

        // 设置会话ID
        $this->setConversationId($params, $chatMessage);

        // 设置额外参数
        $chatMessage->setParams([
            'message_id' => $messageId,
        ]);

        // 获取并设置用户扩展信息
        try {
            $userExtInfo = $this->getUserExtInfo($params, $organizationCode);
            if ($userExtInfo !== null) {
                $chatMessage->setUserExtInfo($userExtInfo);
                $chatMessage->setNickname($userExtInfo->getNickname());
            }
        } catch (Exception $e) {
            $this->logger->warning('获取用户扩展信息失败', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }

        return $chatMessage;
    }

    /**
     * 获取用户扩展信息.
     *
     * @param array $params 请求参数
     * @param string $organizationCode 组织代码
     * @return null|TriggerDataUserExtInfo 用户扩展信息对象
     */
    private function getUserExtInfo(array $params, string $organizationCode): ?TriggerDataUserExtInfo
    {
        try {
            $openId = $params['event']['sender']['sender_id']['open_id'] ?? '';
            if (empty($openId)) {
                $this->logger->warning('用户OpenID为空，无法获取用户信息');
                return null;
            }

            // 缓存起来
            $cacheKey = "feishu_user_ext_info_{$openId}";
            if ($cacheValue = $this->cache->get($cacheKey)) {
                $userExtInfo = unserialize($cacheValue);
                if ($userExtInfo instanceof TriggerDataUserExtInfo) {
                    return $userExtInfo;
                }
            }

            // 从飞书API获取用户信息
            $userInfo = $this->fetchUserInfoFromFeiShu($openId);
            if (empty($userInfo)) {
                return null;
            }

            // 创建用户扩展信息对象
            $realName = $userInfo['name'] ?? $openId;
            $nickname = ! empty($userInfo['nickname']) ? $userInfo['nickname'] : $realName;
            $userExtInfo = new TriggerDataUserExtInfo($organizationCode, $openId, $nickname, $realName);

            // 设置工号和职位
            if (isset($userInfo['employee_no'])) {
                $userExtInfo->setWorkNumber($userInfo['employee_no']);
            }

            if (isset($userInfo['job_title'])) {
                $userExtInfo->setPosition($userInfo['job_title']);
            }

            $this->cache->set($cacheKey, serialize($userExtInfo), 7200);

            return $userExtInfo;
        } catch (Exception $e) {
            $this->logger->error('获取用户信息异常', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return null;
        }
    }

    /**
     * 从飞书API获取用户信息.
     *
     * @param string $openId 用户OpenID
     * @return array 用户信息
     */
    private function fetchUserInfoFromFeiShu(string $openId): array
    {
        try {
            // 获取用户基本信息
            $userInfo = $this->application->contact->user($openId);

            if (empty($userInfo) || ! isset($userInfo['user'])) {
                $this->logger->warning('从飞书获取用户信息失败', ['open_id' => $openId]);
                return [];
            }

            return $userInfo['user'];
        } catch (Exception $e) {
            $this->logger->error('调用飞书API获取用户信息失败', [
                'open_id' => $openId,
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }

    /**
     * 解析消息内容JSON.
     *
     * @param string $content 原始消息内容
     * @return array 解析后的内容数组
     */
    private function decodeMessageContent(string $content): array
    {
        if (empty($content)) {
            return [];
        }

        try {
            $decoded = json_decode($content, true, 512, JSON_THROW_ON_ERROR);
            return is_array($decoded) ? $decoded : [];
        } catch (JsonException $e) {
            $this->logger->warning('解析消息内容失败', [
                'content' => $content,
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }

    /**
     * 设置消息基本信息.
     *
     * @param array $params 请求参数
     * @param ThirdPlatformChatMessage $chatMessage 聊天消息对象
     */
    private function setMessageBasicInfo(array $params, ThirdPlatformChatMessage $chatMessage): void
    {
        $chatId = $params['event']['message']['chat_id'] ?? '';
        $openId = $params['event']['sender']['sender_id']['open_id'] ?? '';

        $chatMessage->setRobotCode($params['header']['app_id'] ?? '');
        $chatMessage->setUserId($openId);
        $chatMessage->setOriginConversationId($chatId);
        $chatMessage->setNickname($openId); // 初始设置为OpenID，后续会通过用户信息更新
    }

    /**
     * 设置会话ID.
     *
     * @param array $params 请求参数
     * @param ThirdPlatformChatMessage $chatMessage 聊天消息对象
     */
    private function setConversationId(array $params, ThirdPlatformChatMessage $chatMessage): void
    {
        $chatType = $params['event']['message']['chat_type'] ?? '';
        $robotCode = $chatMessage->getRobotCode();
        $originConversationId = $chatMessage->getOriginConversationId();

        if ($chatType === self::CHAT_TYPE_P2P) {
            $chatMessage->setType(1);
            $chatMessage->setConversationId(
                "{$robotCode}-{$originConversationId}_feishu_private_chat"
            );
        } elseif ($chatType === self::CHAT_TYPE_GROUP) {
            $chatMessage->setType(2);
            $chatMessage->setConversationId(
                "{$robotCode}-{$originConversationId}_feishu_group_chat"
            );
        } else {
            $this->logger->warning('未知的聊天类型', ['chat_type' => $chatType]);
        }
    }

    /**
     * 处理消息内容.
     *
     * @param string $messageType 消息类型
     * @param array $content 消息内容
     * @param ThirdPlatformChatMessage $chatMessage 聊天消息对象
     * @param string $organizationCode 组织代码
     * @param string $messageId 消息ID
     * @return bool 处理是否成功
     */
    private function processMessageContent(
        string $messageType,
        array $content,
        ThirdPlatformChatMessage $chatMessage,
        string $organizationCode,
        string $messageId
    ): bool {
        $attachments = [];
        $message = '';

        try {
            switch ($messageType) {
                case self::MESSAGE_TYPE_TEXT:
                    $message = $content['text'] ?? '';
                    break;
                case self::MESSAGE_TYPE_IMAGE:
                    $filePath = $this->getFileFromFeiShu($messageId, $content['image_key'] ?? '', 'image');
                    if (! empty($filePath)) {
                        $attachments[] = $this->createAttachment($filePath, $organizationCode);
                    }
                    break;
                case self::MESSAGE_TYPE_FILE:
                    $filePath = $this->getFileFromFeiShu($messageId, $content['file_key'] ?? '', 'file');
                    if (! empty($filePath)) {
                        $attachments[] = $this->createAttachment($filePath, $organizationCode);
                    }
                    break;
                case self::MESSAGE_TYPE_POST:
                    // 处理富文本消息
                    $data = $this->parsePostContentToText($content, $organizationCode, $messageId);
                    $message = $data['markdown'];
                    $attachments = $data['attachments'];
                    break;
                default:
                    // 发送不支持的消息类型提示
                    $this->sendUnsupportedMessageTypeNotice($chatMessage->getOriginConversationId());
                    $chatMessage->setEvent(ThirdPlatformChatEvent::None);
                    return false;
            }

            $chatMessage->setMessage($message);
            $chatMessage->setAttachments($attachments);

            return true;
        } catch (Exception $e) {
            $this->logger->error('处理消息内容失败', [
                'message_type' => $messageType,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // 发送错误提示
            $this->sendErrorNotice($chatMessage->getOriginConversationId());
            $chatMessage->setEvent(ThirdPlatformChatEvent::None);
            return false;
        }
    }

    /**
     * 从飞书获取文件.
     *
     * @param string $messageId 消息ID
     * @param string $fileKey 文件Key
     * @param string $type 文件类型
     * @return string 文件路径
     */
    private function getFileFromFeiShu(string $messageId, string $fileKey, string $type): string
    {
        if (empty($fileKey)) {
            $this->logger->warning('文件Key为空', [
                'message_id' => $messageId,
                'file_type' => $type,
            ]);
            return '';
        }

        try {
            return $this->application->file->getIMFile($messageId, $fileKey, $type);
        } catch (Exception $e) {
            $this->logger->error('获取飞书文件失败', [
                'message_id' => $messageId,
                'file_key' => $fileKey,
                'file_type' => $type,
                'error' => $e->getMessage(),
            ]);
            return '';
        }
    }

    /**
     * 创建附件对象
     *
     * @param string $filePath 文件路径
     * @param string $organizationCode 组织代码
     * @return Attachment 附件对象
     */
    private function createAttachment(string $filePath, string $organizationCode): Attachment
    {
        try {
            return (new LocalAttachment($filePath))->getAttachment($organizationCode);
        } catch (Exception $e) {
            $this->logger->error('创建附件对象失败', [
                'file_path' => $filePath,
                'organization_code' => $organizationCode,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * 发送不支持的消息类型通知.
     *
     * @param string $receiverId 接收者ID
     */
    private function sendUnsupportedMessageTypeNotice(string $receiverId): void
    {
        $data = [
            'receive_id' => $receiverId,
            'msg_type' => 'text',
            'content' => [
                'text' => '暂不支持的消息类型',
            ],
        ];
        $this->application->message->send($data, 'chat_id');

        $this->logger->info('已发送不支持消息类型通知', ['receive_id' => $receiverId]);
    }

    /**
     * 发送错误通知.
     *
     * @param string $receiverId 接收者ID
     */
    private function sendErrorNotice(string $receiverId): void
    {
        $data = [
            'receive_id' => $receiverId,
            'msg_type' => 'text',
            'content' => [
                'text' => '处理消息时发生错误，请稍后再试',
            ],
        ];
        $this->application->message->send($data, 'chat_id');

        $this->logger->info('已发送错误通知', ['receive_id' => $receiverId]);
    }

    /**
     * 解析飞书富文本内容为Markdown文本.
     *
     * @param array $content 飞书富文本内容
     * @param string $organizationCode 组织代码
     * @param string $messageId 消息ID
     * @return array 解析结果，包含markdown文本和附件
     */
    private function parsePostContentToText(array $content, string $organizationCode, string $messageId): array
    {
        $markdown = '';
        $attachments = [];

        // 提取标题（如果有）
        if (! empty($content['title'])) {
            $markdown .= "# {$content['title']}\n\n";
        }

        // 优先使用中文内容，如果没有则使用英文内容
        $postContent = $content['content'] ?? [];

        foreach ($postContent as $paragraph) {
            foreach ($paragraph as $element) {
                $tag = $element['tag'] ?? '';
                $markdown .= $this->processContentElement($tag, $element, $attachments, $organizationCode, $messageId);
            }
            $markdown .= "\n";
        }

        return [
            'markdown' => $markdown,
            'attachments' => $attachments,
        ];
    }

    /**
     * 处理内容元素.
     *
     * @param string $tag 元素标签
     * @param array $element 元素内容
     * @param array &$attachments 附件列表
     * @param string $organizationCode 组织代码
     * @param string $messageId 消息ID
     * @return string 处理后的Markdown文本
     */
    private function processContentElement(
        string $tag,
        array $element,
        array &$attachments,
        string $organizationCode,
        string $messageId
    ): string {
        try {
            switch ($tag) {
                case 'text':
                    return $element['text'] ?? '';
                case 'a':
                    return "[{$element['text']}]({$element['href']})";
                case 'at':
                    return "@{$element['user_name']}";
                case 'img':
                case 'media':
                    return $this->processImageElement($element, $attachments, $organizationCode, $messageId);
                case 'emotion':
                    $emotionKey = $element['emoji_type'] ?? '';
                    return "[:{$emotionKey}:]";
                case 'br':
                    return "\n";
                case 'hr':
                    return "\n---\n";
                case 'code':
                    $language = $element['language'] ?? '';
                    $text = $element['text'] ?? '';
                    return "\n```{$language}\n{$text}\n```\n";
                case 'md':
                    $text = $element['text'] ?? '';
                    return "{$text}\n";
                default:
                    // 对于未知的标签，尝试提取文本内容
                    return $element['text'] ?? '';
            }
        } catch (Exception $e) {
            $this->logger->warning('处理内容元素失败', [
                'tag' => $tag,
                'error' => $e->getMessage(),
            ]);
            return '';
        }
    }

    /**
     * 处理图片元素.
     *
     * @param array $element 元素内容
     * @param array &$attachments 附件列表
     * @param string $organizationCode 组织代码
     * @param string $messageId 消息ID
     * @return string 处理后的Markdown文本
     */
    private function processImageElement(
        array $element,
        array &$attachments,
        string $organizationCode,
        string $messageId
    ): string {
        $fileKey = $element['file_key'] ?? $element['image_key'] ?? '';
        $filePath = $this->getFileFromFeiShu($messageId, $fileKey, 'image');

        if (! empty($filePath)) {
            try {
                $attachments[] = $this->createAttachment($filePath, $organizationCode);
            } catch (Exception $e) {
                $this->logger->warning('添加图片附件失败', [
                    'file_path' => $filePath,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return '';
    }

    /**
     * 解析Markdown内容，转换为飞书富文本格式
     * 只处理图片，其他内容全部使用md样式.
     *
     * @param string $markdown Markdown内容
     * @return array 飞书富文本格式
     */
    private function parseMarkdownToFeiShuPost(string $markdown): array
    {
        // 初始化飞书富文本结构
        $postContent = [
            'title' => '',
            'content' => [],
        ];

        // 使用正则表达式匹配Markdown中的图片
        $pattern = '/!\[(.*?)\]\((.*?)\)/';

        // 如果没有图片，直接返回md格式
        if (! preg_match_all($pattern, $markdown, $matches, PREG_OFFSET_CAPTURE)) {
            $postContent['content'][] = [
                [
                    'tag' => 'md',
                    'text' => $markdown,
                ],
            ];
            return $postContent;
        }

        // 处理包含图片的情况
        $lastPosition = 0;
        $contentBlocks = [];

        // 遍历所有匹配到的图片
        foreach ($matches[0] as $index => $match) {
            $fullMatch = $match[0];
            $position = $match[1];
            $url = $matches[2][$index][0];

            // 添加图片前的文本（如果有）
            $this->addTextBlockIfNotEmpty(
                $contentBlocks,
                substr($markdown, $lastPosition, $position - $lastPosition)
            );

            // 处理图片
            $this->processImageBlock($contentBlocks, $url, $fullMatch);

            // 更新处理位置
            $lastPosition = $position + strlen($fullMatch);
        }

        // 添加最后一个图片后的文本（如果有）
        $this->addTextBlockIfNotEmpty(
            $contentBlocks,
            substr($markdown, $lastPosition)
        );

        $postContent['content'] = $contentBlocks;
        return $postContent;
    }

    /**
     * 添加文本块（如果不为空）.
     *
     * @param array &$contentBlocks 内容块数组
     * @param string $text 要添加的文本
     */
    private function addTextBlockIfNotEmpty(array &$contentBlocks, string $text): void
    {
        $text = trim($text);
        if ($text !== '') {
            $contentBlocks[] = [
                [
                    'tag' => 'md',
                    'text' => $text,
                ],
            ];
        }
    }

    /**
     * 处理图片块.
     *
     * @param array &$contentBlocks 内容块数组
     * @param string $url 图片URL
     * @param string $fallbackText 上传失败时的回退文本
     */
    private function processImageBlock(array &$contentBlocks, string $url, string $fallbackText): void
    {
        try {
            $imageKey = $this->application->image->uploadByUrl($url);
            $contentBlocks[] = [
                [
                    'tag' => 'img',
                    'image_key' => $imageKey,
                    'width' => self::DEFAULT_IMAGE_WIDTH,
                    'height' => self::DEFAULT_IMAGE_HEIGHT,
                ],
            ];
        } catch (Exception $e) {
            $this->logger->notice('UploadImageToFeiShuFailed', [
                'url' => $url,
                'error' => $e->getMessage(),
            ]);
            // 如果上传失败，添加图片URL作为md文本
            $contentBlocks[] = [
                [
                    'tag' => 'md',
                    'text' => $fallbackText,
                ],
            ];
        }
    }
}
