<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Volcengine\SpeechRecognition;

use App\Domain\Speech\Entity\Dto\SpeechQueryDTO;
use App\Domain\Speech\Entity\Dto\SpeechSubmitDTO;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class VolcengineStandardClient
{
    private const SUBMIT_URL = 'https://openspeech.bytedance.com/api/v1/auc/submit';

    private const QUERY_URL = 'https://openspeech.bytedance.com/api/v1/auc/query';

    protected LoggerInterface $logger;

    protected Client $httpClient;

    protected array $config;

    public function __construct()
    {
        $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get(self::class);
        $this->httpClient = new Client([
            'timeout' => 30,
            'connect_timeout' => 10,
        ]);
        $this->config = $this->getVolcengineConfig();
    }

    public function submitTask(SpeechSubmitDTO $submitDTO): array
    {
        $requestData = $this->buildSubmitRequest($submitDTO);

        try {
            $response = $this->httpClient->post(self::SUBMIT_URL, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer; ' . $this->config['token'],
                ],
                'json' => $requestData,
            ]);

            $responseBody = $response->getBody()->getContents();
            $result = json_decode($responseBody, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('Failed to parse Volcengine response JSON', [
                    'response_body' => $responseBody,
                    'json_error' => json_last_error_msg(),
                ]);
                ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.invalid_response_format');
            }

            $this->logger->info('Volcengine speech recognition task submitted successfully', [
                'response' => $result,
            ]);

            return $result;
        } catch (GuzzleException $e) {
            $this->logger->error('Failed to submit task to Volcengine', [
                'error' => $e->getMessage(),
                'request_data' => $requestData,
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, $e->getMessage());
        } catch (Throwable $e) {
            $this->logger->error('Exception occurred while submitting task to Volcengine', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.submit_exception', [
                'original_error' => $e->getMessage(),
            ]);
        }
    }

    public function queryResult(SpeechQueryDTO $queryDTO): array
    {
        $requestData = $this->buildQueryRequest($queryDTO);

        try {
            $response = $this->httpClient->post(self::QUERY_URL, [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer; ' . $this->config['token'],
                ],
                'json' => $requestData,
            ]);

            $responseBody = $response->getBody()->getContents();
            $result = json_decode($responseBody, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logger->error('Failed to parse Volcengine response JSON', [
                    'response_body' => $responseBody,
                    'json_error' => json_last_error_msg(),
                ]);
                ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.invalid_response_format');
            }

            return $result;
        } catch (GuzzleException $e) {
            $this->logger->error('Failed to query result from Volcengine', [
                'task_id' => $queryDTO->getTaskId(),
                'error' => $e->getMessage(),
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, $e->getMessage());
        } catch (Throwable $e) {
            $this->logger->error('Exception occurred while querying result from Volcengine', [
                'task_id' => $queryDTO->getTaskId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(AsrErrorCode::Error, 'speech.volcengine.query_exception', [
                'original_error' => $e->getMessage(),
            ]);
        }
    }

    private function getVolcengineConfig(): array
    {
        $config = config('asr.volcengine', []);

        if (empty($config['app_id']) || empty($config['token']) || empty($config['cluster'])) {
            ExceptionBuilder::throw(AsrErrorCode::InvalidConfig, 'speech.volcengine.config_incomplete');
        }

        return $config;
    }

    private function buildSubmitRequest(SpeechSubmitDTO $submitDTO): array
    {
        $userRequestData = $submitDTO->toVolcengineRequestData();

        $requestData = [
            'app' => [
                'appid' => $this->config['app_id'],
                'token' => $this->config['token'],
                'cluster' => $this->config['cluster'],
            ],
        ];

        return array_merge($requestData, $userRequestData);
    }

    private function buildQueryRequest(SpeechQueryDTO $queryDTO): array
    {
        return [
            'appid' => $this->config['app_id'],
            'token' => $this->config['token'],
            'cluster' => $this->config['cluster'],
            'id' => $queryDTO->getTaskId(),
        ];
    }
}
