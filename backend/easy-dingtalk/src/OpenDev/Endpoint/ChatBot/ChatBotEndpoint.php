<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\ChatBot;

use Dtyq\EasyDingTalk\Kernel\Exceptions\BadRequestException;
use Dtyq\EasyDingTalk\OpenDev\Api\ChatBot\DownloadFileApi;
use Dtyq\EasyDingTalk\OpenDev\Api\ChatBot\SendGroupMessageApi;
use Dtyq\EasyDingTalk\OpenDev\Api\ChatBot\SendOneOnOneChatMessagesApi;
use Dtyq\EasyDingTalk\OpenDev\Endpoint\OpenDevEndpoint;
use Dtyq\EasyDingTalk\OpenDev\Parameter\ChatBot\DownloadFileParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\ChatBot\SendGroupMessageParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\ChatBot\SendOneOnOneChatMessagesParameter;
use Dtyq\EasyDingTalk\OpenDev\Result\ChatBot\DownloadFileResult;
use Dtyq\EasyDingTalk\OpenDev\Result\ChatBot\SendGroupMessageResult;
use Dtyq\EasyDingTalk\OpenDev\Result\ChatBot\SendOneOnOneChatMessagesResult;
use GuzzleHttp\RequestOptions;

class ChatBotEndpoint extends OpenDevEndpoint
{
    public function sendOneOnOneChatMessages(SendOneOnOneChatMessagesParameter $parameter): SendOneOnOneChatMessagesResult
    {
        $parameter->validate();

        $api = new SendOneOnOneChatMessagesApi();
        $api->setOptions([
            RequestOptions::HEADERS => [
                'x-acs-dingtalk-access-token' => $parameter->getAccessToken(),
            ],
            RequestOptions::JSON => [
                'robotCode' => $parameter->getRobotCode(),
                'userIds' => $parameter->getUserIds(),
                'msgKey' => $parameter->getMsgKey(),
                'msgParam' => $parameter->getMsgParam(),
            ],
        ]);

        $response = $this->send($api);
        $data = json_decode($response->getBody()->getContents(), true);
        $processQueryKey = $data['processQueryKey'] ?? null;
        if (empty($processQueryKey) || $response->getStatusCode() !== 200) {
            throw new BadRequestException('发送失败');
        }
        return new SendOneOnOneChatMessagesResult($data);
    }

    public function sendGroupMessage(SendGroupMessageParameter $parameter): SendGroupMessageResult
    {
        $parameter->validate();

        $api = new SendGroupMessageApi();
        $api->setOptions([
            RequestOptions::HEADERS => [
                'x-acs-dingtalk-access-token' => $parameter->getAccessToken(),
            ],
            RequestOptions::JSON => [
                'robotCode' => $parameter->getRobotCode(),
                'openConversationId' => $parameter->getOpenConversationId(),
                'msgKey' => $parameter->getMsgKey(),
                'msgParam' => $parameter->getMsgParam(),
            ],
        ]);

        $response = $this->send($api);
        $data = json_decode($response->getBody()->getContents(), true);
        $processQueryKey = $data['processQueryKey'] ?? null;
        if (empty($processQueryKey) || $response->getStatusCode() !== 200) {
            throw new BadRequestException('发送失败');
        }
        return new SendGroupMessageResult($data);
    }

    public function downloadFile(DownloadFileParameter $parameter): DownloadFileResult
    {
        $parameter->validate();

        $api = new DownloadFileApi();
        $api->setOptions([
            RequestOptions::HEADERS => [
                'x-acs-dingtalk-access-token' => $parameter->getAccessToken(),
            ],
            RequestOptions::JSON => [
                'robotCode' => $parameter->getRobotCode(),
                'downloadCode' => $parameter->getDownloadCode(),
            ],
        ]);

        $response = $this->send($api);
        $data = json_decode($response->getBody()->getContents(), true);
        $downloadUrl = $data['downloadUrl'] ?? null;
        if (empty($downloadUrl) || $response->getStatusCode() !== 200) {
            throw new BadRequestException('下载失败');
        }
        return new DownloadFileResult($data);
    }
}
