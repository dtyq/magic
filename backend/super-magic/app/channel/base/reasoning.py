def to_blockquote(text: str) -> str:
    # 每行加 '> ' 前缀，转为 markdown blockquote
    return "\n".join(f"> {line}" for line in text.split("\n"))


def format_elapsed(elapsed_ms: int) -> str:
    # 毫秒转人类可读时长，不足 60s 显示秒，否则显示分秒
    seconds = elapsed_ms / 1000
    if seconds < 60:
        if elapsed_ms > 0:
            seconds = max(seconds, 0.1)
        return f"{seconds:.1f}s"
    return f"{int(seconds // 60)}m {int(seconds % 60)}s"


def build_streaming_reasoning_text(reasoning: str) -> str:
    # 流式推理阶段展示：固定标题行 + blockquote 化的推理内容
    return f"> 💭 思考中...\n>\n{to_blockquote(reasoning)}"


def build_streaming_content_text(answer: str, reasoning: str = "", elapsed_ms: int = 0) -> str:
    # 内容阶段的流式展示也要保留思考块，避免覆盖式更新把前文冲掉。
    if not reasoning:
        return answer
    return build_final_message(answer, reasoning, elapsed_ms)


def build_final_message(answer: str, reasoning: str = "", elapsed_ms: int = 0) -> str:
    # 无推理内容直接返回答案；有推理则在上方附带耗时 + blockquote
    if not reasoning:
        return answer
    header = f"> 💭 思考了 {format_elapsed(elapsed_ms)}"
    blockquote = f"{header}\n>\n{to_blockquote(reasoning)}"
    return f"{blockquote}\n\n{answer}"


# 钉钉的流式卡片对 markdown blockquote（> 语法）存在渲染缺陷：
# 流式更新时 blockquote 内容不会实时刷新，会造成思考块整体消失再重现。
# 因此钉钉渠道单独使用纯文本版本，用 --- 分隔思考与正文。

def build_streaming_reasoning_text_plain(reasoning: str) -> str:
    return f"💭 思考中...\n\n{reasoning}"


def build_streaming_content_text_plain(answer: str, reasoning: str = "", elapsed_ms: int = 0) -> str:
    if not reasoning:
        return answer
    return build_final_message_plain(answer, reasoning, elapsed_ms)


def build_final_message_plain(answer: str, reasoning: str = "", elapsed_ms: int = 0) -> str:
    if not reasoning:
        return answer
    return f"💭 思考了 {format_elapsed(elapsed_ms)}\n\n{reasoning}\n\n---\n\n{answer}"
