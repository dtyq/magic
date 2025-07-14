<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Facade\Open;

use App\Application\Flow\Service\MagicFlowExecuteAppService;
use App\Interfaces\Flow\Assembler\MagicFlowExecuteLogAssembler;
use App\Interfaces\Flow\DTO\MagicFlowApiChatDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class MagicFlowOpenApi extends AbstractOpenApi
{
    #[Inject]
    protected MagicFlowExecuteAppService $magicFlowExecuteAppServiceService;

    #[Inject]
    protected MagicFlowExecuteLogAssembler $magicFlowExecuteLogAssembler;

    public function chat()
    {
        $apiChatDTO = $this->createApiChatDTO();
        $apiChatDTO->setAsync(false);
        return $this->magicFlowExecuteAppServiceService->apiChat($apiChatDTO);
    }

    public function chatWithId(string $botId)
    {
        return $this->chat();
    }

    public function chatAsync()
    {
        $apiChatDTO = $this->createApiChatDTO();
        $apiChatDTO->setAsync(true);
        return $this->magicFlowExecuteAppServiceService->apiChat($apiChatDTO);
    }

    public function chatCompletions()
    {
        $apiChatDTO = $this->createApiChatDTO();
        $apiChatDTO->setAsync(false);
        $apiChatDTO->setVersion('v1');
        return $this->magicFlowExecuteAppServiceService->apiChat($apiChatDTO);
    }

    public function paramCall()
    {
        $apiChatDTO = $this->createApiChatDTO();
        $apiChatDTO->setStream(false);
        return $this->magicFlowExecuteAppServiceService->apiParamCall($apiChatDTO);
    }

    public function paramCallWithId(string $code)
    {
        return $this->paramCall();
    }

    public function paramCallAsync()
    {
        $apiChatDTO = $this->createApiChatDTO();
        $apiChatDTO->setAsync(true);
        $apiChatDTO->setStream(false);
        return $this->magicFlowExecuteAppServiceService->apiParamCall($apiChatDTO);
    }

    public function getExecuteResult(string $taskId)
    {
        $apiChatDTO = $this->createApiChatDTO();
        $apiChatDTO->setTaskId($taskId);
        $log = $this->magicFlowExecuteAppServiceService->getByExecuteId($apiChatDTO);
        return $this->magicFlowExecuteLogAssembler->createExecuteResultDTO($log);
    }

    private function createApiChatDTO(): MagicFlowApiChatDTO
    {
        $apiChatDTO = new MagicFlowApiChatDTO($this->request->all());

        $apiChatDTO->setApiKey($this->request->header('api-key', ''));
        $apiChatDTO->setAuthorization($this->request->header('authorization', ''));

        // 如果 environment_code 存在与 header 中
        if (empty($apiChatDTO->getEnvironmentCode())
            && ($this->request->hasHeader('environment-code') || $this->request->hasHeader('environment_code') || $this->request->hasHeader('teamshare_environment_code'))) {
            $apiChatDTO->setEnvironmentCode(
                $this->request->header('environment-code', $this->request->header('environment_code', $this->request->header('teamshare_environment_code')))
            );
        }

        // 兼容 openai 的 messages 入参
        $params = $this->request->all();
        if (isset($params['messages'])) {
            foreach ($params['messages'] as $messageArr) {
                if (($messageArr['role'] ?? '') === 'user') {
                    $message = $messageArr['content'];
                    $apiChatDTO->setMessage($message);
                    break;
                }
            }
        }

        // 处理 instruction 参数
        if (isset($params['instruction']) && is_array($params['instruction'])) {
            $apiChatDTO->setInstruction($params['instruction']);
        }

        return $apiChatDTO;
    }
}
