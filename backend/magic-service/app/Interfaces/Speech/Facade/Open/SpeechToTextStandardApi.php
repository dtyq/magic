<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Speech\Facade\Open;

use App\Application\Speech\Event\SpeechRecognitionUsageEvent;
use App\Application\Speech\Service\SpeechToTextStandardAppService;
use App\Domain\Speech\Entity\Dto\FlashSpeechSubmitDTO;
use App\Domain\Speech\Entity\Dto\LargeModelSpeechSubmitDTO;
use App\Domain\Speech\Entity\Dto\SpeechQueryDTO;
use App\Domain\Speech\Entity\Dto\SpeechSubmitDTO;
use App\Domain\Speech\Entity\Dto\SpeechUserDTO;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\MagicUserAuthorizationTrait;
use App\Infrastructure\ExternalAPI\Volcengine\ValueObject\VolcengineStatusCode;
use App\Interfaces\ModelGateway\Facade\Open\AbstractOpenApi;
use Hyperf\Context\Context;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Redis\Redis;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Log\LoggerInterface;

class SpeechToTextStandardApi extends AbstractOpenApi
{
    use MagicUserAuthorizationTrait;

    # 定义type 常量
    public const VOLCENGINE_TYPE = 'volcengine';

    private const PROCESSED_KEY_PREFIX = 'speech:processed:';

    private const PROCESSED_TTL = 3600; // 1 hour

    #[Inject]
    protected SpeechToTextStandardAppService $speechToTextStandardAppService;

    #[Inject]
    protected Redis $redis;

    #[Inject]
    protected EventDispatcherInterface $eventDispatcher;

    #[Inject]
    protected LoggerInterface $logger;

    public function submit(RequestInterface $request): array
    {
        $requestData = $request->all();

        if (empty($requestData['audio']['url'])) {
            ExceptionBuilder::throw(AsrErrorCode::AudioUrlRequired);
        }

        $submitDTO = new SpeechSubmitDTO($requestData);
        $submitDTO->setaccessToken($this->getAccessToken());
        $submitDTO->setIps($this->getClientIps());
        $submitDTO->setUser(new SpeechUserDTO(['uid' => $this->getAccessToken()]));

        $result = $this->speechToTextStandardAppService->submitTask($submitDTO);
        $type = $requestData['type'] ?? self::VOLCENGINE_TYPE;

        if ($type === self::VOLCENGINE_TYPE) {
            return $this->setVolcengineHeaders($result);
        }
        return $result;
    }

    public function query(RequestInterface $request, string $taskId)
    {
        if (empty($taskId)) {
            ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.task_id_required');
        }

        $requestData = $request->all();
        $queryDTO = new SpeechQueryDTO(['task_id' => $taskId]);
        $queryDTO->setaccessToken($this->getAccessToken());
        $queryDTO->setIps($this->getClientIps());
        $type = $requestData['type'] ?? self::VOLCENGINE_TYPE;

        $result = $this->speechToTextStandardAppService->queryResult($queryDTO);

        if ($type === self::VOLCENGINE_TYPE) {
            return $this->setVolcengineHeaders($result);
        }
        return $result;
    }

    public function submitLargeModel(RequestInterface $request): array
    {
        $requestData = $request->all();

        if (empty($requestData['audio']['url'])) {
            ExceptionBuilder::throw(AsrErrorCode::AudioUrlRequired);
        }
        $type = $requestData['type'] ?? self::VOLCENGINE_TYPE;

        $submitDTO = new LargeModelSpeechSubmitDTO($requestData);
        $submitDTO->setAccessToken($this->getAccessToken());
        $submitDTO->setIps($this->getClientIps());
        $submitDTO->setUser(new SpeechUserDTO(['uid' => $this->getAccessToken()]));

        $result = $this->speechToTextStandardAppService->submitLargeModelTask($submitDTO);

        if ($type === self::VOLCENGINE_TYPE) {
            return $this->setVolcengineHeaders($result);
        }
        return $result;
    }

    public function queryLargeModel(RequestInterface $request, string $requestId)
    {
        if (empty($requestId)) {
            ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.task_id_required');
        }

        $requestData = $request->all();
        $type = $requestData['type'] ?? self::VOLCENGINE_TYPE;

        $speechQueryDTO = new SpeechQueryDTO(['task_id' => $requestId]);
        $speechQueryDTO->setAccessToken($this->getAccessToken());
        $speechQueryDTO->setIps($this->getClientIps());

        $result = $this->speechToTextStandardAppService->queryLargeModelResult($speechQueryDTO);
        $resultArray = $result->toArray();

        // Parse task status and audio duration from response
        $taskStatus = $result->getVolcengineStatusCode();
        $audioDuration = $result->getAudioInfo()->getDuration();

        $businessParams = $this->formatHeaderBusinessParams();
        $businessParams['audio_duration'] = $audioDuration;

        $organizationCode = $this->getAuthorization()->getOrganizationCode();
        $userId = $this->getAuthorization()->getId();
        $businessParams['organization_code'] = $organizationCode;
        $businessParams['user_id'] = $userId;
        // Trigger event with idempotency check (only once per task_id)
        // Note: $requestId is used as task_id for large model queries
        $this->logger->info('SpeechToTextStandardApi queryLargeModel', [
            'request_id' => $requestId,
            'task_status' => $taskStatus,
            'is_processed' => $this->isTaskProcessed($requestId),
            'organization_code' => $organizationCode,
            'user_id' => $userId,
            'audio_duration' => $audioDuration,
        ]);
        if ($taskStatus === VolcengineStatusCode::SUCCESS && ! $this->isTaskProcessed($requestId)) {
            $this->eventDispatcher->dispatch(new SpeechRecognitionUsageEvent(
                provider: self::VOLCENGINE_TYPE,
                organizationCode: $organizationCode,
                userId: $userId,
                businessParams: $businessParams
            ));
            $this->markTaskAsProcessed($requestId);
        }

        if ($type === self::VOLCENGINE_TYPE) {
            return $this->setVolcengineHeaders($resultArray);
        }
        return $resultArray;
    }

    public function flash(RequestInterface $request): array
    {
        $requestData = $request->all();

        if (empty($requestData['audio']['url'])) {
            ExceptionBuilder::throw(AsrErrorCode::AudioUrlRequired);
        }

        $submitDTO = new FlashSpeechSubmitDTO($requestData);
        $submitDTO->setAccessToken($this->getAccessToken());
        $submitDTO->setIps($this->getClientIps());
        $submitDTO->setUser(new SpeechUserDTO(['uid' => $this->getAccessToken()]));

        $result = $this->speechToTextStandardAppService->submitFlashTask($submitDTO);
        $type = $requestData['type'] ?? self::VOLCENGINE_TYPE;

        if ($type === self::VOLCENGINE_TYPE) {
            return $this->setVolcengineHeaders($result);
        }
        return $result;
    }

    private function setVolcengineHeaders(array $result): array
    {
        $response = Context::get(ResponseInterface::class);

        if (isset($result['volcengine_log_id'])) {
            $response = $response->withHeader('X-Volcengine-Log-Id', $result['volcengine_log_id']);
            unset($result['volcengine_log_id']);
        }

        if (isset($result['volcengine_status_code'])) {
            $response = $response->withHeader('X-Volcengine-Status-Code', $result['volcengine_status_code']);
            unset($result['volcengine_status_code']);
        }

        if (isset($result['volcengine_message'])) {
            $response = $response->withHeader('X-Volcengine-Message', $result['volcengine_message']);
            unset($result['volcengine_message']);
        }

        Context::set(ResponseInterface::class, $response);
        return $result;
    }

    /**
     * Check if task has been processed (idempotency).
     *
     * @param string $taskId Task ID or Request ID
     */
    private function isTaskProcessed(string $taskId): bool
    {
        $key = self::PROCESSED_KEY_PREFIX . $taskId;
        return (bool) $this->redis->exists($key);
    }

    /**
     * Mark task as processed (idempotency).
     *
     * @param string $taskId Task ID or Request ID
     */
    private function markTaskAsProcessed(string $taskId): void
    {
        $key = self::PROCESSED_KEY_PREFIX . $taskId;
        $this->redis->setex($key, self::PROCESSED_TTL, (string) time());
    }

    private function formatHeaderBusinessParams(): array
    {
        $businessParams = [];
        $headerConfigs = [];
        foreach ($this->request->getHeaders() as $key => $value) {
            $key = strtolower((string) $key);
            $headerConfigs[$key] = $this->request->getHeader($key)[0] ?? '';
        }
        if (isset($headerConfigs['magic-organization-id'])) {
            $businessParams['organization_id'] = $headerConfigs['magic-organization-id'];
        }
        if (isset($headerConfigs['magic-organization-code'])) {
            $businessParams['organization_id'] = $headerConfigs['magic-organization-code'];
        }
        if (isset($headerConfigs['magic-user-id'])) {
            $businessParams['user_id'] = $headerConfigs['magic-user-id'];
        }
        if (isset($headerConfigs['business_id'])) {
            $businessParams['business_id'] = $headerConfigs['business_id'];
        }
        if (isset($headerConfigs['magic-topic-id'])) {
            $businessParams['magic_topic_id'] = $headerConfigs['magic-topic-id'];
        }
        if (isset($headerConfigs['magic-chat-topic-id'])) {
            $businessParams['magic_chat_topic_id'] = $headerConfigs['magic-chat-topic-id'];
        }
        if (isset($headerConfigs['magic-task-id'])) {
            $businessParams['magic_task_id'] = $headerConfigs['magic-task-id'];
        }
        if (isset($headerConfigs['magic-language'])) {
            $businessParams['language'] = $headerConfigs['magic-language'];
        }
        return $businessParams;
    }
}
