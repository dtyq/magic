<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service\ThirdPlatformChat\DingRobot;

use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformChatEvent;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformChatInterface;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformChatMessage;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformCreateGroup;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformCreateSceneGroup;
use App\Application\Flow\ExecuteManager\Attachment\ExternalAttachment;
use App\Application\Flow\ExecuteManager\ExecutionData\TriggerDataUserExtInfo;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Chat\DTO\Message\MessageInterface;
use App\ErrorCode\AgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\EasyDingTalk\OpenDev\Parameter\ChatBot\DownloadFileParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\ChatBot\SendGroupMessageParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\ChatBot\SendOneOnOneChatMessagesParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\Conversation\CreateGroupParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\Conversation\CreateSceneGroupParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\Department\GetAllParentDepartmentByUserParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\Department\GetDeptByIdParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\User\GetUserInfoByMobileParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\User\GetUserInfoByUserIdParameter;
use Dtyq\EasyDingTalk\OpenDev\Result\ChatBot\DownloadFileResult;
use Dtyq\EasyDingTalk\OpenDev\Result\Department\AllParentDepartmentResult;
use Dtyq\EasyDingTalk\OpenDevFactory;
use Dtyq\SdkBase\SdkBase;
use Hyperf\Context\ApplicationContext;
use Psr\SimpleCache\CacheInterface;
use Throwable;

class DingRobotChat implements ThirdPlatformChatInterface
{
    private OpenDevFactory $openDevFactory;

    private CacheInterface $cache;

    public function __construct(array $options)
    {
        $this->openDevFactory = $this->createOpenDevFactory($options);
        $this->cache = ApplicationContext::getContainer()->get(CacheInterface::class);
    }

    public function parseChatParam(array $params): ThirdPlatformChatMessage
    {
        // 1 单聊 2 群聊
        if (empty($params['conversationType'])) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'conversationType']);
        }

        if (empty($params['robotCode'])) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'robotCode']);
        }
        $robotCode = $params['robotCode'];
        if (empty($params['msgtype'])) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'msgtype']);
        }
        $chatMessage = new ThirdPlatformChatMessage();
        if (empty($params['conversationId'])) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'conversationId']);
        }
        $chatMessage->setEvent(ThirdPlatformChatEvent::ChatMessage);
        $chatMessage->setOriginConversationId($params['conversationId']);
        $chatMessage->setNickname($params['senderNick'] ?? '');
        $chatMessage->setUserId($params['senderStaffId'] ?? '');
        $chatMessage->setRobotCode($robotCode);
        $chatMessage->setType((int) $params['conversationType']);

        if ($chatMessage->getType() === 1) {
            $chatMessage->setConversationId("{$chatMessage->getRobotCode()}-{$chatMessage->getUserId()}_ding_private_chat");
        }
        if ($chatMessage->getType() === 2) {
            $chatMessage->setConversationId($chatMessage->getOriginConversationId() . '_ding_group_chat');
        }

        $message = '';
        $attachments = [];
        // 目前只解析 文本、图片、富文本
        switch ($params['msgtype']) {
            case 'text':
                $message = $params['text']['content'] ?? '';
                break;
            case 'picture':
                if (isset($params['content']['downloadCode'])) {
                    $url = $this->getDownloadFile($robotCode, $params['content']['downloadCode'])->getDownloadUrl();
                    $attachments[] = new ExternalAttachment($url);
                }
                break;
            case 'richText':
                foreach ($params['content']['richText'] ?? [] as $item) {
                    if (! empty($item['downloadCode'])) {
                        $url = $this->getDownloadFile($robotCode, $item['downloadCode'])->getDownloadUrl();
                        $attachments[] = new ExternalAttachment($url);
                    }
                    if (isset($item['text'])) {
                        $message .= $item['text'] . ' \n';
                    }
                }
                break;
            default:
        }
        $message = trim($message);
        $chatMessage->setMessage($message);
        $chatMessage->setAttachments($attachments);

        // 加载用户扩展信息
        $this->setUserExtInfo($chatMessage);

        return $chatMessage;
    }

    public function sendMessage(ThirdPlatformChatMessage $thirdPlatformChatMessage, MessageInterface $message): void
    {
        // 目前仅发送文本出去
        if (! $message instanceof TextMessage) {
            return;
        }
        $content = $message->getContent();
        if ($thirdPlatformChatMessage->getType() === 1) {
            $param = new SendOneOnOneChatMessagesParameter($this->openDevFactory->accessTokenEndpoint->get());
            $param->setRobotCode($thirdPlatformChatMessage->getRobotCode());
            $param->setUserIds([$thirdPlatformChatMessage->getUserId()]);
            $param->setMsgKey('sampleMarkdown');
            $param->setMsgParam(json_encode([
                'title' => mb_substr($content, 0, 25),
                'text' => $content,
            ], JSON_UNESCAPED_UNICODE));
            try {
                $this->openDevFactory->chatBotEndpoint->sendOneOnOneChatMessages($param);
            } catch (Throwable $throwable) {
                // 钉钉 下载图片时间较长，超过了3000ms，网关直接返回了超时错误。发送消息此时跳过
                simple_log('SendOneOnOneChatMessagesError', [
                    'error' => $throwable->getMessage(),
                ]);
            }
        }
        if ($thirdPlatformChatMessage->getType() === 2) {
            $param = new SendGroupMessageParameter($this->openDevFactory->accessTokenEndpoint->get());
            $param->setRobotCode($thirdPlatformChatMessage->getRobotCode());
            $param->setOpenConversationId($thirdPlatformChatMessage->getOriginConversationId());
            $param->setMsgKey('sampleMarkdown');
            $param->setMsgParam(json_encode([
                'title' => mb_substr($content, 0, 25),
                'text' => $content,
            ], JSON_UNESCAPED_UNICODE));
            try {
                $this->openDevFactory->chatBotEndpoint->sendGroupMessage($param);
            } catch (Throwable $throwable) {
                // 钉钉 下载图片时间较长，超过了3000ms，网关直接返回了超时错误。发送消息此时跳过
                simple_log('SendGroupMessageError', [
                    'error' => $throwable->getMessage(),
                ]);
            }
        }
    }

    /**
     * 通过手机号获取第三方用户id.
     * @param string $mobile 手机号码
     * @return string 第三方用户id，返回格式
     */
    public function getThirdPlatformUserIdByMobiles(string $mobile): string
    {
        if (empty($mobile)) {
            return '';
        }

        try {
            $param = new GetUserInfoByMobileParameter($this->openDevFactory->accessTokenEndpoint->get());
            $param->setMobile($mobile);
            $userInfo = $this->openDevFactory->userEndpoint->getUserIdByMobile($param);
            return $userInfo->getUserid();
        } catch (Throwable $throwable) {
            simple_log('GetUserInfoByMobileError', [
                'error' => $throwable->getMessage(),
            ]);
            return '';
        }
    }

    /**
     * 创建场景群.
     */
    public function createSceneGroup(ThirdPlatformCreateSceneGroup $params): string
    {
        try {
            $parameter = new CreateSceneGroupParameter($this->openDevFactory->accessTokenEndpoint->get());
            $parameter->setTitle($params->getTitle());
            $parameter->setOwnerUserId($params->getOwnerUserId());
            $parameter->setUserIds(implode(',', $params->getUserIds()));
            $parameter->setTemplateId($params->getTemplateId());
            $parameter->setUuid($params->getUuid());
            $result = $this->openDevFactory->conversationEndpoint->createSceneGroup($parameter);
            return $result->getOpenConversationId();
        } catch (Throwable $throwable) {
            simple_log('CreateSceneGroupError', [
                'error' => $throwable->getMessage(),
            ]);
            return '';
        }
    }

    /**
     * 创建普通群组.
     * @see https://oapi.dingtalk.com/chat/create
     */
    public function createGroup(ThirdPlatformCreateGroup $params): string
    {
        try {
            $parameter = new CreateGroupParameter($this->openDevFactory->accessTokenEndpoint->get());
            $parameter->setName($params->getName());
            $parameter->setOwner($params->getOwner());
            $parameter->setUseridlist($params->getUseridlist());
            $parameter->setShowHistoryType($params->getShowHistoryType());
            $parameter->setSearchable($params->getSearchable());
            $parameter->setValidationType($params->getValidationType());
            $parameter->setMentionAllAuthority($params->getMentionAllAuthority());
            $parameter->setManagementType($params->getManagementType());
            $parameter->setChatBannedType($params->getChatBannedType());
            $result = $this->openDevFactory->conversationEndpoint->createGroup($parameter);
            return $result->getChatid();
        } catch (Throwable $throwable) {
            simple_log('CreateGroupError', [
                'error' => $throwable->getMessage(),
            ]);
            return '';
        }
    }

    protected function getDownloadFile(string $robotCode, string $downloadCode): DownloadFileResult
    {
        $param = new DownloadFileParameter($this->openDevFactory->accessTokenEndpoint->get());
        $param->setRobotCode($robotCode);
        $param->setDownloadCode($downloadCode);
        return $this->openDevFactory->chatBotEndpoint->downloadFile($param);
    }

    private function setUserExtInfo(ThirdPlatformChatMessage $thirdPlatformChatMessage): void
    {
        // 缓存起来
        $cacheKey = "ding_user_ext_info_{$thirdPlatformChatMessage->getUserId()}";
        if ($cacheValue = $this->cache->get($cacheKey)) {
            $userExtInfo = unserialize($cacheValue);
            if ($userExtInfo instanceof TriggerDataUserExtInfo) {
                $thirdPlatformChatMessage->setUserExtInfo($userExtInfo);
                return;
            }
        }

        // 获取用户信息
        $getUserInfoByUserIdParameter = new GetUserInfoByUserIdParameter($this->openDevFactory->accessTokenEndpoint->get());
        $getUserInfoByUserIdParameter->setUserId($thirdPlatformChatMessage->getUserId());
        $userInfo = $this->openDevFactory->userEndpoint->getUserInfoByUserId($getUserInfoByUserIdParameter);

        $userExtInfo = new TriggerDataUserExtInfo(
            organizationCode: '',
            userId: $thirdPlatformChatMessage->getUserId(),
            nickname: $userInfo->getName(),
            realName: $userInfo->getName(),
        );

        // 获取用户的所有部门上级
        $param = new GetAllParentDepartmentByUserParameter($this->openDevFactory->accessTokenEndpoint->get());
        $param->setUserId($thirdPlatformChatMessage->getUserId());
        $list = $this->openDevFactory->departmentEndpoint->getAllParentDepartmentByUser($param);
        $departmentArray = [];
        /**
         * @var AllParentDepartmentResult $allParentDepartmentResult
         */
        foreach ($list as $deptId => $allParentDepartmentResult) {
            // 获取部门信息
            $getDeptByIdParameter = new GetDeptByIdParameter($this->openDevFactory->accessTokenEndpoint->get());
            $getDeptByIdParameter->setDeptId($deptId);
            $departmentResult = $this->openDevFactory->departmentEndpoint->getDeptById($getDeptByIdParameter);
            $pathNames = [];
            foreach ($allParentDepartmentResult->getParentDeptIdList() as $parentDeptId) {
                $getDeptByIdParameter = new GetDeptByIdParameter($this->openDevFactory->accessTokenEndpoint->get());
                $getDeptByIdParameter->setDeptId($parentDeptId);
                $parentDepartmentResult = $this->openDevFactory->departmentEndpoint->getDeptById($getDeptByIdParameter);
                $pathNames[] = $parentDepartmentResult->getName();
            }
            $departmentArray[] = [
                'id' => $deptId,
                'name' => $departmentResult->getName(),
                'path' => implode('/', array_reverse($pathNames)),
            ];
        }

        $userExtInfo->setPosition($userInfo->getTitle());
        $userExtInfo->setWorkNumber($userInfo->getJobNumber());
        $userExtInfo->setDepartments($departmentArray);

        $thirdPlatformChatMessage->setUserExtInfo($userExtInfo);

        $this->cache->set($cacheKey, serialize($userExtInfo), 7200);
    }

    private function createOpenDevFactory(array $options): OpenDevFactory
    {
        $configs = [
            'host' => 'https://api.dingtalk.com',
            'sdk_name' => 'easy-ding-talk',
            'applications' => [
                'app' => [
                    'type' => 'open_dev',
                    'options' => $options,
                ],
            ],
        ];
        $sdkBase = new SdkBase(ApplicationContext::getContainer(), $configs);
        return new OpenDevFactory('app', $sdkBase);
    }
}
