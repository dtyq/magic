"""
Streaming Log Utility Module

流式处理日志工具模块，统一管理流式 LLM 调用过程中的日志输出。
"""

import json
from typing import Any, Dict, Optional

from agentlang.logger import get_logger

from .streaming_util import StreamingState

logger = get_logger(__name__)

# Chunk 日志相关常量
SLOW_CHUNK_THRESHOLD = 3.0  # 警告阈值：3秒（正常chunk间隔为0.1-2秒，超过3秒视为慢速）
VERY_SLOW_CHUNK_THRESHOLD = 8.0  # 严重警告阈值：8秒（超过8秒视为严重异常）
CHUNK_PROGRESS_INTERVAL = 200  # 每N个chunk打印一次进度
CHUNK_DETAIL_LOG_COUNT = 5  # 前N个chunk记录详细信息


class StreamingLogger:
    """
    流式处理日志管理类。

    提供统一的日志方法，用于记录流式处理过程中的各种事件和状态。
    """

    # ===== Chunk 处理相关日志 =====

    @staticmethod
    def log_chunk_received(
        request_id: str,
        state: StreamingState,
        interval_time: float,
        total_latency: float,
        correlation_id: str,
        chunk: Any
    ) -> None:
        """
        统一的 chunk 接收日志方法，内部处理所有判断逻辑

        Args:
            request_id: 请求 ID
            state: 流式状态对象
            interval_time: chunk 间隔时间（秒）
            total_latency: 总耗时（秒）
            correlation_id: 关联 ID
            chunk: chunk 内容
        """
        chunk_count = state.received_chunk_count

        # 延迟监控：记录慢速 chunk 的警告日志
        if interval_time > VERY_SLOW_CHUNK_THRESHOLD:
            logger.warning(
                f"[{request_id}] 检测到严重慢速chunk！"
                f"chunk编号={chunk_count}, 间隔={interval_time:.3f}秒 (>{VERY_SLOW_CHUNK_THRESHOLD}秒), "
                f"总耗时={total_latency:.3f}秒, correlation_id={correlation_id}"
            )
        elif interval_time > SLOW_CHUNK_THRESHOLD:
            logger.info(
                f"[{request_id}] 检测到慢速chunk："
                f"chunk编号={chunk_count}, 间隔={interval_time:.3f}秒 (>{SLOW_CHUNK_THRESHOLD}秒), "
                f"总耗时={total_latency:.3f}秒, correlation_id={correlation_id}"
            )

        # 记录前几个 chunk 的详细信息
        if chunk_count <= CHUNK_DETAIL_LOG_COUNT:
            logger.info(
                f"[{request_id}] 第{chunk_count}个数据块已接收，"
                f"总耗时: {total_latency:.3f}秒，间隔: {interval_time:.3f}秒，"
                f"数据块内容: {chunk}"
            )

        # 进度日志
        if chunk_count % CHUNK_PROGRESS_INTERVAL == 0:
            logger.info(f"[{request_id}] 已接收 {chunk_count} 个数据块，当前数据块内容: {chunk}")

    @staticmethod
    def log_invalid_chunk(request_id: str, state: StreamingState, chunk_type: type, should_stop: bool = False) -> None:
        """
        记录无效 chunk

        Args:
            request_id: 请求 ID
            state: 流式状态对象
            chunk_type: chunk 类型
            should_stop: 是否应该停止处理
        """
        if should_stop:
            logger.error(f"[{request_id}] 连续收到{state.invalid_chunk_count}个无效chunk，主动停止流式处理")
        else:
            logger.warning(f"[{request_id}] 收到非标准的chunk类型: {chunk_type}")

    @staticmethod
    def log_empty_chunks_stop(request_id: str, state: StreamingState, time_since_last: float) -> None:
        """
        记录因连续空 chunk 而停止

        Args:
            request_id: 请求 ID
            state: 流式状态对象
            time_since_last: 距上次有效内容的时间（秒）
        """
        logger.warning(
            f"[{request_id}] 连续收到{state.empty_chunk_count}个空chunk (阈值={state.MAX_EMPTY_CHUNK_COUNT})，"
            f"可能流已结束但未正确关闭 (已等待{time_since_last:.1f}秒)，主动停止流式处理"
        )

    # ===== 流式状态日志 =====

    @staticmethod
    def log_stream_start(request_id: str, correlation_id: str) -> None:
        """记录流式处理开始"""
        logger.info(f"[{request_id}] 开始等待流式响应... (correlation_id={correlation_id})")

    @staticmethod
    def log_stream_interrupted(request_id: str, state: StreamingState, correlation_id: str) -> None:
        """记录流式处理被中断"""
        logger.info(f"[{request_id}] 流式处理立即响应中断信号 (已处理{state.received_chunk_count}个chunks, correlation_id={correlation_id})")

    @staticmethod
    def log_finish_reason_received(request_id: str, state: StreamingState, finish_reason: str, correlation_id: str) -> None:
        """记录收到完成状态"""
        logger.info(f"[{request_id}] 检测到完成状态 finish_reason='{finish_reason}'，等待 usage 信息块 (已处理{state.received_chunk_count}个chunks, correlation_id={correlation_id})")

    @staticmethod
    def log_usage_received_stop(request_id: str, state: StreamingState, correlation_id: str, chunk: Any) -> None:
        """记录收到 usage 信息后停止"""
        logger.info(f"[{request_id}] 收到 usage 信息块，主动停止流式处理 (已处理{state.received_chunk_count}个chunks, correlation_id={correlation_id})，最后一个数据块内容: {chunk}")

    @staticmethod
    def log_stream_normal_end(request_id: str, state: StreamingState, finish_reason: str, correlation_id: str, last_chunk: Any = None) -> None:
        """记录流式处理正常结束"""
        if last_chunk:
            logger.info(
                f"[{request_id}] 流式处理正常结束 "
                f"(已处理{state.received_chunk_count}个chunks, finish_reason={finish_reason}, correlation_id={correlation_id})，"
                f"最后一个数据块内容: {last_chunk}"
            )
        else:
            logger.info(
                f"[{request_id}] 流式处理正常结束 "
                f"(已处理{state.received_chunk_count}个chunks, finish_reason={finish_reason}, correlation_id={correlation_id})"
            )

    @staticmethod
    def log_tool_call_end_stream(request_id: str, content_type: str) -> None:
        """记录因工具调用而结束流式输出"""
        if content_type == "reasoning":
            logger.info(f"[{request_id}] 检测到工具调用，结束 reasoning 流式输出（工具调用仍属于思考）")
        else:
            logger.info(f"[{request_id}] 检测到工具调用，结束 content 流式输出")

    # ===== 异常日志 =====

    @staticmethod
    def log_stream_abnormal_end(
        request_id: str,
        state: StreamingState,
        correlation_id: str,
        has_usage: bool,
        root_cause_info: str,
        last_chunk: Any
    ) -> str:
        """
        记录流式响应异常中断

        Returns:
            str: 构建的错误消息
        """
        # 构建工具调用信息
        tool_calls_info = ""
        if state.tool_calls:
            for idx, tc in state.tool_calls.items():
                func_name = tc.get("function", {}).get("name", "unknown")
                args = tc.get("function", {}).get("arguments", "")
                tool_calls_info += f"\n    工具{idx}: {func_name}"
                tool_calls_info += f"\n      参数长度: {len(args)} 字符"
                if len(args) > 0:
                    args_preview = args[:200] + "...(已截断)" if len(args) > 200 else args
                    tool_calls_info += f"\n      参数内容: {args_preview}"

        error_msg = (
            f"流式响应异常中断！连接已关闭但未收到完成标记 (finish_reason=None)。\n"
            f"  已处理chunk数: {state.received_chunk_count}\n"
            f"  已收到文本长度: {len(state.content_text)} 字符\n"
            f"  文本内容预览: {state.content_text[:100]}{'...(已截断)' if len(state.content_text) > 100 else ''}\n"
            f"  是否有工具调用: {'是' if state.tool_calls else '否'}{tool_calls_info}\n"
            f"  是否有usage信息: {'是' if has_usage else '否'}\n"
            f"  {root_cause_info}\n"
            f"  最后一个chunk: {last_chunk}\n"
            f"\n可能原因:\n"
            f"  1. magic-gateway 或上游 API 超时或内部错误\n"
            f"  2. 网络中断、代理超时或负载均衡器断开连接\n"
            f"  3. 上游服务配额限制或流控\n"
            f"  4. HTTP连接被意外关闭（如超过网关超时时间）"
        )

        logger.error(f"[{request_id}] {error_msg} (correlation_id={correlation_id})")
        return error_msg

    @staticmethod
    def log_chunk_timeout(request_id: str, state: StreamingState) -> None:
        """记录 chunk 超时"""
        logger.error(f"[{request_id}] 等待chunk超时 (已处理{state.received_chunk_count}个chunks) - 抛出异常")

    @staticmethod
    def log_chunk_exception(request_id: str, state: StreamingState, error: Exception) -> None:
        """记录处理 chunk 时的异常"""
        logger.error(f"[{request_id}] 处理chunk时发生异常: {error}，已处理{state.received_chunk_count}个chunks")

    @staticmethod
    def log_parallel_task_exception(request_id: str, error: Exception) -> None:
        """记录并行任务处理异常"""
        logger.error(f"[{request_id}] 并行任务处理异常: {error}")

    @staticmethod
    def log_stream_timeout(request_id: str, state: StreamingState, timeout: int, correlation_id: str) -> None:
        """记录流式处理超时"""
        logger.error(f"[{request_id}] 流式处理超时 ({timeout}s)，已处理 {state.received_chunk_count} 个chunks (correlation_id={correlation_id})")

    @staticmethod
    def log_stream_error(request_id: str, state: StreamingState, error: Exception, correlation_id: str) -> None:
        """记录流式处理错误"""
        logger.error(f"[{request_id}] 流式处理出错: {error}，已处理 {state.received_chunk_count} 个chunks (correlation_id={correlation_id})")

    @staticmethod
    def log_no_data_received(request_id: str, correlation_id: str) -> None:
        """记录未收到任何数据"""
        logger.warning(f"[{request_id}] 流式调用没有收到任何数据块，可能服务端返回了错误 (correlation_id={correlation_id})")

    # ===== 统计日志 =====

    @staticmethod
    def log_stream_stats(
        request_id: str,
        state: StreamingState,
        correlation_id: str,
        total_time: float,
        finish_reason: Optional[str]
    ) -> None:
        """记录流式处理统计信息"""
        stats = {
            "请求ID": request_id,
            "关联ID": correlation_id,
            "总chunks数": state.received_chunk_count,
            "总耗时秒": round(total_time, 3),
            "平均chunk间隔秒": round(total_time / state.received_chunk_count, 3) if state.received_chunk_count > 0 else 0,
            "最大chunk间隔秒": round(state.max_chunk_interval, 3),
            "慢chunk数": state.slow_chunk_count,
            "慢chunk阈值秒": SLOW_CHUNK_THRESHOLD,
            "严重慢chunk数": state.very_slow_chunk_count,
            "严重慢chunk阈值秒": VERY_SLOW_CHUNK_THRESHOLD,
            "空chunk数": state.empty_chunk_count,
            "无效chunk数": state.invalid_chunk_count,
            "完成原因": finish_reason
        }
        logger.info(f"[{request_id}] 流式处理统计: {json.dumps(stats, ensure_ascii=False)}")

    @staticmethod
    def log_reasoning_collected(request_id: str, state: StreamingState) -> None:
        """记录收集到的思考内容"""
        if state.reasoning_text:
            logger.info(f"[{request_id}] 收集到思考内容: {len(state.reasoning_text)} 字符")

    # ===== HTTP 请求日志 =====

    @staticmethod
    def log_http_request_start(request_id: str, correlation_id: str) -> None:
        """记录 HTTP 请求开始"""
        logger.info(f"[{request_id}] 发送HTTP流式请求... (correlation_id={correlation_id})")

    @staticmethod
    def log_http_response_received(request_id: str, latency: float, correlation_id: str) -> None:
        """记录 HTTP 响应头返回"""
        logger.info(f"[{request_id}] HTTP响应头已返回，耗时: {latency:.3f}秒 (correlation_id={correlation_id})")

    # ===== Debug 日志 =====

    @staticmethod
    def log_thinking_detected(request_id: str) -> None:
        """记录检测到思考内容"""
        logger.debug(f"[{request_id}] 检测到思考内容，设置 is_thinking=True")

    @staticmethod
    def log_stream_phase_start(request_id: str, content_type: str) -> None:
        """记录流式输出阶段开始"""
        logger.debug(f"[{request_id}] 开始 {content_type} 流式输出")

    @staticmethod
    def log_stream_phase_end(request_id: str, content_type: str, reason: str = "流结束") -> None:
        """记录流式输出阶段结束"""
        logger.debug(f"[{request_id}] {reason}，发送 {content_type} 流式结束标记")

    @staticmethod
    def log_after_think_triggered(request_id: str) -> None:
        """记录触发 AFTER_AGENT_THINK"""
        logger.debug(f"[{request_id}] 触发 AFTER_AGENT_THINK（检测到 content）")
