<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service\ThirdPlatformChat\WeChatRobot;

use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformChatEvent;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformChatInterface;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformChatMessage;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformCreateGroup;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformCreateSceneGroup;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Chat\DTO\Message\MessageInterface;
use EasyWeChat\Work\Application as WorkApplication;
use EasyWeChat\Work\Server as WorkServer;
use GuzzleHttp\RequestOptions;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class WeChatRobotChat implements ThirdPlatformChatInterface
{
    protected WorkApplication $workApplication;

    protected WorkServer $workServer;

    protected LoggerInterface $logger;

    public function __construct(array $options)
    {
        $this->logger = di(LoggerFactory::class)->get('WeChatRobotChat');
        $app = new WorkApplication($options);
        $app->setRequest(di(RequestInterface::class));
        $this->workApplication = $app;
        /* @phpstan-ignore-next-line */
        $this->workServer = $app->getServer();
    }

    public function parseChatParam(array $params): ThirdPlatformChatMessage
    {
        $chatMessage = new ThirdPlatformChatMessage();

        if (isset($params['msg_signature'], $params['echostr'])) {
            $chatMessage->setEvent(ThirdPlatformChatEvent::CheckServer);
            $response = $this->workServer->serve();
            $chatMessage->setResponse($response);
        } else {
            $chatMessage->setEvent(ThirdPlatformChatEvent::ChatMessage);
            $messageAttributes = $this->workServer->getDecryptedMessage()->toArray();

            $chatMessage->setOriginConversationId($messageAttributes['FromUserName']);
            $chatMessage->setNickname($messageAttributes['FromUserName'] ?? '');
            $chatMessage->setUserId($messageAttributes['FromUserName'] ?? '');
            $chatMessage->setRobotCode($messageAttributes['AgentID'] ?? '');
            $chatMessage->setType(1);

            if ($chatMessage->getType() === 1) {
                $chatMessage->setConversationId("{$chatMessage->getRobotCode()}-{$chatMessage->getUserId()}_wx_work_private_chat");
            }
            $chatMessage->setMessage($messageAttributes['Content'] ?? '');
        }

        return $chatMessage;
    }

    public function sendMessage(ThirdPlatformChatMessage $thirdPlatformChatMessage, MessageInterface $message): void
    {
        if (! $message instanceof TextMessage) {
            return;
        }
        $content = $message->getContent();
        // 由于微信不支持富文本或者 markdown 中支持图片，所以需要在这里将 markdown 中的图片和视频直接移除，不需要展示
        $content = preg_replace('/!\[.*?\]\((.*?)\)/', '', $content);
        $content = preg_replace('/\[这里有一个视频]\((.*?)\)/', '', $content);

        $api = $this->workApplication->getClient();
        $options = [
            RequestOptions::JSON => [
                'touser' => $thirdPlatformChatMessage->getUserId(),
                'msgtype' => 'markdown',
                'agentid' => $thirdPlatformChatMessage->getRobotCode(),
                'markdown' => [
                    'content' => $content,
                ],
            ],
        ];
        $response = $api->post('/cgi-bin/message/send', $options);
        $this->logger->info('WeChatRobotChatSendMessage', [
            'request' => $options,
            'response' => $response->toArray(false),
            'debug' => $response->getInfo(),
        ]);
    }

    public function getThirdPlatformUserIdByMobiles(string $mobile): string
    {
        // TODO: Implement getThirdPlatformUserIdByMobiles() method.
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
}
