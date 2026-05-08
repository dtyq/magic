<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mock;

use Hyperf\Codec\Json;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;
use Throwable;

class PaymentApi
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly Redis $redis,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('MockPaymentApi');
    }

    /**
     * 微信 Native 下单 mock.
     */
    public function wechatNative(RequestInterface $request): array
    {
        $payload = $request->all();
        $order = $this->storeWechatOrder($payload, 'NATIVE');

        $this->logger->info('[Mock Payment] WeChat native order created', [
            'out_trade_no' => $order['out_trade_no'],
            'amount_total' => $order['amount_total'],
            'currency' => $order['currency'],
        ]);

        return [
            'code_url' => 'weixin://wxpay/mock?out_trade_no=' . rawurlencode($order['out_trade_no']),
        ];
    }

    /**
     * 微信 App 下单 mock.
     */
    public function wechatApp(RequestInterface $request): array
    {
        $payload = $request->all();
        $order = $this->storeWechatOrder($payload, 'APP');

        $this->logger->info('[Mock Payment] WeChat app order created', [
            'out_trade_no' => $order['out_trade_no'],
            'amount_total' => $order['amount_total'],
            'currency' => $order['currency'],
        ]);

        return [
            'prepay_id' => 'mock_prepay_' . $order['out_trade_no'],
        ];
    }

    /**
     * 微信按商户订单号查单 mock.
     */
    public function wechatQuery(RequestInterface $request): array
    {
        $outTradeNo = (string) $request->route('outTradeNo', '');
        $order = $this->getWechatOrder($outTradeNo);

        $this->logger->info('[Mock Payment] WeChat order queried', [
            'out_trade_no' => $outTradeNo,
            'found' => $order !== null,
        ]);

        if ($order === null) {
            return [
                'appid' => '',
                'mchid' => (string) $request->query('mchid', ''),
                'out_trade_no' => $outTradeNo,
                'transaction_id' => '',
                'trade_type' => 'NATIVE',
                'trade_state' => 'NOTPAY',
                'trade_state_desc' => 'mock order not found',
                'amount' => [
                    'total' => 0,
                    'currency' => 'CNY',
                ],
            ];
        }

        return [
            'appid' => $order['appid'],
            'mchid' => $order['mchid'],
            'out_trade_no' => $order['out_trade_no'],
            'transaction_id' => $order['transaction_id'],
            'trade_type' => $order['trade_type'],
            'trade_state' => 'SUCCESS',
            'trade_state_desc' => '支付成功',
            'success_time' => date(DATE_ATOM),
            'amount' => [
                'total' => $order['amount_total'],
                'currency' => $order['currency'],
            ],
        ];
    }

    /**
     * 外部项目支付结果通知 mock.
     */
    public function proxyNotify(RequestInterface $request): array
    {
        $payload = $request->all();
        $magicOrderId = (string) ($payload['magic_order_id'] ?? '');

        $this->logger->info('[Mock Payment] Payment proxy notify received', [
            'magic_order_id' => $magicOrderId,
            'external_order_no' => (string) ($payload['external_order_no'] ?? ''),
            'status' => (string) ($payload['status'] ?? ''),
        ]);

        if ($magicOrderId !== '') {
            $this->redis->setex($this->getProxyNotifyKey($magicOrderId), 86400, Json::encode([
                'headers' => [
                    'x-app-id' => $request->getHeaderLine('X-App-Id'),
                    'x-timestamp' => $request->getHeaderLine('X-Timestamp'),
                    'x-nonce' => $request->getHeaderLine('X-Nonce'),
                    'x-sign' => $request->getHeaderLine('X-Sign'),
                ],
                'payload' => $payload,
                'notified_at' => date(DATE_ATOM),
            ]));
        }

        return [
            'code' => 1000,
            'message' => 'success',
            'data' => null,
        ];
    }

    /**
     * @return array{appid: string, mchid: string, out_trade_no: string, transaction_id: string, trade_type: string, amount_total: int, currency: string}
     */
    private function storeWechatOrder(array $payload, string $tradeType): array
    {
        $outTradeNo = (string) ($payload['out_trade_no'] ?? '');
        $amount = is_array($payload['amount'] ?? null) ? $payload['amount'] : [];
        $amountTotal = (int) ($amount['total'] ?? 0);
        $currency = strtoupper((string) ($amount['currency'] ?? 'CNY'));

        $order = [
            'appid' => (string) ($payload['appid'] ?? ''),
            'mchid' => (string) ($payload['mchid'] ?? ''),
            'out_trade_no' => $outTradeNo,
            'transaction_id' => 'mock_wx_tx_' . $outTradeNo,
            'trade_type' => $tradeType,
            'amount_total' => $amountTotal,
            'currency' => $currency,
        ];

        if ($outTradeNo !== '') {
            $this->redis->setex($this->getWechatOrderKey($outTradeNo), 86400, Json::encode($order));
        }

        return $order;
    }

    /**
     * @return null|array{appid: string, mchid: string, out_trade_no: string, transaction_id: string, trade_type: string, amount_total: int, currency: string}
     */
    private function getWechatOrder(string $outTradeNo): ?array
    {
        if ($outTradeNo === '') {
            return null;
        }

        $payload = $this->redis->get($this->getWechatOrderKey($outTradeNo));
        if (! is_string($payload) || $payload === '') {
            return null;
        }

        try {
            $order = Json::decode($payload);
        } catch (Throwable) {
            return null;
        }

        return is_array($order) ? $order : null;
    }

    private function getWechatOrderKey(string $outTradeNo): string
    {
        return 'mock:payment:wechat:' . md5($outTradeNo);
    }

    private function getProxyNotifyKey(string $magicOrderId): string
    {
        return 'mock:payment:proxy_notify:' . md5($magicOrderId);
    }
}
