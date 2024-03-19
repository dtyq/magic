<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Hyperf\SocketIOServer;

use App\Infrastructure\Core\ClassMap\SocketIoServer\Contract\SidLifecycleProviderInterface;
use App\Infrastructure\Core\ClassMap\SocketIoServer\Enum\SocketIOLifecycleEvent;
use App\Infrastructure\Core\ClassMap\SocketIoServer\Enum\SocketIOSidGuardEvent;
use Closure;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\OnCloseInterface;
use Hyperf\Contract\OnMessageInterface;
use Hyperf\Contract\OnOpenInterface;
use Hyperf\Contract\StdoutLoggerInterface;
use Hyperf\Coordinator\Timer;
use Hyperf\Engine\Channel;
use Hyperf\Engine\WebSocket\Frame;
use Hyperf\Engine\WebSocket\Response;
use Hyperf\SocketIOServer\Collector\EventAnnotationCollector;
use Hyperf\SocketIOServer\Collector\SocketIORouter;
use Hyperf\SocketIOServer\Exception\RouteNotFoundException;
use Hyperf\SocketIOServer\Parser\Decoder;
use Hyperf\SocketIOServer\Parser\Encoder;
use Hyperf\SocketIOServer\Parser\Engine;
use Hyperf\SocketIOServer\Parser\Packet;
use Hyperf\SocketIOServer\Room\EphemeralInterface;
use Hyperf\SocketIOServer\SidProvider\DistributedSidProvider;
use Hyperf\SocketIOServer\SidProvider\SidProviderInterface;
use Hyperf\WebSocketServer\Constant\Opcode;
use Hyperf\WebSocketServer\Sender;
use RuntimeException;
use Swow\Psr7\Server\ServerConnection;
use Swow\SocketException;
use Throwable;

use function Hyperf\Support\make;

/**
 *  packet types
 *  0 open
 *  Sent from the server when new transport is opened (recheck)
 *  1 close
 *  Request the close of this transport but does not shut down the connection itself.
 *  2 ping
 *  Sent by the client. Server should answer with a pong packet containing the same data
 *  3 pong
 *  Sent by the server to respond to ping packets.
 *  4 message
 *  actual message, client and server should call their callbacks with the data.
 *  5 upgrade
 *  Before engine.io switches a transport, it tests, if server and client can communicate over this transport. If this *    test succeed, the client sends an upgrade packets which requests the server to flush its cache on the old transport *   and switch to the new transport.
 *  6 noop
 *  A noop packet. Used primarily to force a poll cycle when an incoming websocket connection is received.
 *  packet data types
 *  Packet#CONNECT (0)
 *  Packet#DISCONNECT (1)
 *  Packet#EVENT (2)
 *  Packet#ACK (3)
 *  Packet#ERROR (4)
 *  Packet#BINARY_EVENT (5)
 *  Packet#BINARY_ACK (6)
 *  basic format    => $socket->emit("message", "hello world");
 *                  => sprintf('%d%d%s', $packetType, $packetDataType, json_encode([$event, $data]))
 *                  => 42["message", "hello world"].
 * @mixin BaseNamespace
 */
class SocketIO implements OnMessageInterface, OnOpenInterface, OnCloseInterface
{
    public static bool $isMainWorker = false;

    public static string $serverId = '';

    public static ?Atomic $messageId = null;

    /**
     * @var Channel[]
     */
    protected array $clientCallbacks = [];

    /**
     * @var int[]
     */
    protected array $clientCallbackTimers = [];

    protected SocketIOConfig $config;

    protected Timer $timer;

    public function __construct(
        protected StdoutLoggerInterface $stdoutLogger,
        protected Sender $sender,
        protected Decoder $decoder,
        protected Encoder $encoder,
        protected SidProviderInterface $sidProvider,
        ?SocketIOConfig $config = null
    ) {
        $this->config = $config ?? ApplicationContext::getContainer()->get(SocketIOConfig::class);
        $this->timer = new Timer();
    }

    public function __call($method, $args)
    {
        return $this->of('/')->{$method}(...$args);
    }

    /**
     * @param ServerConnection $server
     * @param mixed $frame
     */
    /* @phpstan-ignore-next-line */
    public function onMessage($server, $frame): void
    {
        // 链接不可用时，不再尝试推送消息
        if (! $server->isAvailable()) {
            return;
        }
        try {
            $response = (new Response($server))->init($frame);
            $frame = Frame::from($frame);
            $data = (string) $frame->getPayloadData();
            if ($frame->getOpcode() == Opcode::PING) {
                $response->push(new Frame(opcode: Opcode::PONG));
                return;
            }

            if ($data[0] === Engine::PING) {
                $this->renewInAllNamespaces($response->getFd());
                $response->push(new Frame(payloadData: Engine::PONG));
                return;
            }
            if ($data[0] === Engine::CLOSE) {
                $response->close();
                return;
            }
            if ($data[0] !== Engine::MESSAGE) {
                $this->stdoutLogger->error("EngineIO event type {$data[0]} not supported");
                return;
            }

            $packet = $this->decoder->decode($data);
            switch ($packet->type) {
                case Packet::OPEN: // client open
                    $responsePacket = Packet::create([
                        'type' => Packet::OPEN,
                        'nsp' => $packet->nsp,
                    ]);
                    $response->push(new Frame(payloadData: Engine::MESSAGE . $this->encoder->encode($responsePacket)));
                    break;
                case Packet::CLOSE: // client disconnect
                    $response->close();
                    break;
                case Packet::EVENT: // client message with ack
                    if ($packet->id !== '') {
                        $packet->data[] = function ($data) use ($packet, $response) {
                            $responsePacket = Packet::create([
                                'id' => $packet->id,
                                'nsp' => $packet->nsp,
                                'type' => Packet::ACK,
                                'data' => $data,
                            ]);

                            $this->sender->pushFrame($response->getFd(), new Frame(payloadData: Engine::MESSAGE . $this->encoder->encode($responsePacket)));
                        };
                    }
                    $this->dispatch($response->getFd(), $packet->nsp, ...$packet->data);
                    break;
                case Packet::ACK: // server ack
                    $ackId = $packet->id;
                    if (isset($this->clientCallbacks[$ackId]) && $this->clientCallbacks[$ackId] instanceof Channel) {
                        if (is_array($packet->data)) {
                            foreach ($packet->data as $piece) {
                                $this->clientCallbacks[$ackId]->push($piece);
                            }
                        } else {
                            $this->clientCallbacks[$ackId]->push($packet->data);
                        }
                        unset($this->clientCallbacks[$ackId]);
                        $this->timer->clear($this->clientCallbackTimers[$ackId]);
                    }
                    break;
                default:
                    $this->stdoutLogger->error("SocketIO packet type {$packet->type} not supported");
            }
        } catch (SocketException) {
            // 不处理链接断开等 socket 异常
        }
    }

    public function onOpen($server, $request): void
    {
        $response = (new Response($server))->init($request);
        $fd = $response->getFd();
        $sidAssigned = false;
        try {
            $sid = $this->assignSidForOpen($fd);
            $sidAssigned = true;

            $data = [
                'sid' => $sid,
                'upgrades' => ['websocket'],
                'pingInterval' => $this->config->getPingInterval(),
                'pingTimeout' => $this->config->getPingTimeout(),
            ];

            $response->push(new Frame(payloadData: Engine::OPEN . json_encode($data))); // socket is open
            $response->push(new Frame(payloadData: Engine::MESSAGE . Packet::OPEN)); // server open

            $this->dispatchEventInAllNamespaces($fd, SocketIOLifecycleEvent::Connect->value);
        } catch (Throwable $exception) {
            if ($sidAssigned) {
                $this->rollbackSidAfterOpenFailure($fd);
            }
            $this->abortOpen($response, $fd, $exception);
        }
    }

    public function onClose($server, int $fd, int $reactorId): void
    {
        try {
            $this->dispatchEventInAllNamespaces($fd, SocketIOLifecycleEvent::Disconnect->value);
        } finally {
            $this->unregisterSidForClose($fd);
        }
    }

    /**
     * @return BaseNamespace|NamespaceInterface possibly a BaseNamespace, but allow user to use any NamespaceInterface implementation instead
     */
    public function of(string $nsp): NamespaceInterface
    {
        $class = SocketIORouter::getClassName($nsp);
        if (! $class) {
            throw new RouteNotFoundException("namespace {$nsp} is not registered.");
        }
        if (! ApplicationContext::getContainer()->has($class)) {
            throw new RouteNotFoundException("namespace {$nsp} cannot be instantiated.");
        }
        return ApplicationContext::getContainer()->get($class);
    }

    public function addCallback(string $ackId, Channel $channel, ?int $timeoutMs = null)
    {
        $this->clientCallbacks[$ackId] = $channel;
        // Clean up using timer to avoid memory leak.
        $timerId = $this->timer->after($timeoutMs ?? $this->config->getClientCallbackTimeout(), function () use ($ackId) {
            if (! isset($this->clientCallbacks[$ackId])) {
                return;
            }
            $this->clientCallbacks[$ackId]->close();
            unset($this->clientCallbacks[$ackId]);
        });
        $this->clientCallbackTimers[$ackId] = $timerId;
    }

    public function setClientCallbackTimeout(int $clientCallbackTimeout): static
    {
        $this->config->setClientCallbackTimeout($clientCallbackTimeout);
        return $this;
    }

    public function setPingInterval(int $pingInterval): static
    {
        $this->config->setPingInterval($pingInterval);
        return $this;
    }

    public function setPingTimeout(int $pingTimeout): static
    {
        $this->config->setPingTimeout($pingTimeout);
        return $this;
    }

    /**
     * 统一在 onOpen 分配 sid。
     * 如果 provider 支持连接生命周期接口，则走显式注册；否则走兼容查询模式。
     */
    private function assignSidForOpen(int $fd): string
    {
        $sid = $this->sidProvider instanceof SidLifecycleProviderInterface
            ? $this->sidProvider->registerConnection($fd)
            : $this->sidProvider->getSid($fd);

        if ($sid === '') {
            throw new RuntimeException(sprintf('sid assign failed for fd %d', $fd));
        }

        return $sid;
    }

    /**
     * onOpen 失败时统一关闭连接并记录结构化日志，避免散落多层 try/catch。
     */
    private function abortOpen(Response $response, int $fd, Throwable $exception): void
    {
        $event = $this->isConnSeqOverflow($exception)
            ? SocketIOSidGuardEvent::ConnSeqOverflow->value
            : SocketIOSidGuardEvent::SidAssignFailed->value;
        $this->stdoutLogger->error(sprintf(
            'sidGuard event=%s fd=%d error=%s',
            $event,
            $fd,
            $exception->getMessage()
        ));

        try {
            $response->close();
            return;
        } catch (Throwable) {
        }

        try {
            $this->sender->disconnect($fd);
        } catch (Throwable) {
        }
    }

    /**
     * onClose 的 finally 阶段释放 sid 映射，保证业务回调异常也不会泄漏连接态。
     * 如果进程直接崩溃未执行到这里，Redis TTL + 过期清理会承担最终兜底。
     */
    private function unregisterSidForClose(int $fd): void
    {
        if ($this->sidProvider instanceof SidLifecycleProviderInterface) {
            $this->sidProvider->unregisterConnection($fd);
        }
    }

    /**
     * onOpen 流程里 sid 已注册但后续步骤异常时，主动回滚映射避免残留窗口。
     */
    private function rollbackSidAfterOpenFailure(int $fd): void
    {
        if (! $this->sidProvider instanceof SidLifecycleProviderInterface) {
            return;
        }

        try {
            $this->sidProvider->unregisterConnection($fd);
        } catch (Throwable $exception) {
            $this->stdoutLogger->warning(sprintf(
                'sidGuard event=%s fd=%d error=%s',
                SocketIOSidGuardEvent::SidOpenRollbackFailed->value,
                $fd,
                $exception->getMessage()
            ));
        }
    }

    /**
     * 只在 provider 抛出约定错误码时判定为 conn seq overflow，避免依赖消息文案。
     */
    private function isConnSeqOverflow(Throwable $exception): bool
    {
        return $exception->getCode() === DistributedSidProvider::CONN_SEQ_OVERFLOW_CODE;
    }

    private function dispatch(int $fd, string $nsp, string $event, ...$payloads): void
    {
        $socket = $this->makeSocket($fd, $nsp);
        if (empty($socket)) {
            return;
        }
        $ack = null;

        // Check if ack is required
        $last = array_pop($payloads);
        if ($last instanceof Closure) {
            $ack = $last;
        } else {
            array_push($payloads, $last);
        }

        $handlers = $this->getEventHandlers($nsp, $event);
        foreach ($handlers as $handler) {
            $result = $handler($socket, ...$payloads);
            $ack && $ack([$result]);
        }
    }

    private function getEventHandlers(string $nsp, string $event): array
    {
        $class = SocketIORouter::getClassName($nsp);
        /** @var NamespaceInterface $instance */
        $instance = ApplicationContext::getContainer()->get($class);

        /** @var callable[] $output */
        $output = [];

        foreach (EventAnnotationCollector::get($class . '.' . $event, []) as [, $method]) {
            $output[] = [$instance, $method];
        }

        foreach ($instance->getEventHandlers() as $key => $callbacks) {
            if ($key === $event) {
                $output = array_merge($callbacks, $output);
            }
        }

        return $output;
    }

    private function makeSocket(int $fd, string $nsp = '/'): ?Socket
    {
        try {
            return make(Socket::class, [
                'adapter' => SocketIORouter::getAdapter($nsp),
                'sender' => $this->sender,
                'fd' => $fd,
                'nsp' => $nsp,
                'addCallback' => function (string $ackId, Channel $channel, ?int $timeout = null) {
                    $this->addCallback($ackId, $channel, $timeout);
                },
            ]);
        } catch (Throwable $exception) {
            $this->stdoutLogger->error('Socket.io ' . $exception->getMessage());
            return null;
        }
    }

    private function dispatchEventInAllNamespaces(int $fd, string $event)
    {
        $all = SocketIORouter::list();
        if (! array_key_exists('forward', $all)) {
            return;
        }
        foreach (array_keys($all['forward']) as $nsp) {
            $this->dispatch($fd, $nsp, $event, null);
        }
    }

    private function renewInAllNamespaces(int $fd)
    {
        $all = SocketIORouter::list();
        if (! array_key_exists('forward', $all)) {
            return;
        }
        foreach (array_keys($all['forward']) as $nsp) {
            $adapter = $this->of($nsp)->getAdapter();
            if ($adapter instanceof EphemeralInterface) {
                $sid = $this->sidProvider->getSid($fd);
                // sid 为空说明当前 fd 没有有效映射，跳过续期避免写入无效会话数据。
                if ($sid === '') {
                    continue;
                }
                $adapter->renew($sid);
            }
        }
    }
}
