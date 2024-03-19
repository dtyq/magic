"""
动态生成 magic_video 的 index.html

本脚本在 analyze_video_project 工具中被调用，用于动态生成视频播放器界面。
基于 magic_audio 的 index.html 模板，进行以下转换：
1. 替换 media-player-implementation 脚本内容（使用视频播放器实现）
2. 删除 <audio> 标签
3. 在 .custom-player 内部插入视频播放器容器 DOM（<div id="media-player">）
4. 替换页面标题

注意：
- 视频播放器容器的样式（#media-player）由 media-player-implementation.js 动态注入
- 所有 video 相关的样式和逻辑都在 media-player-implementation.js 中管理
- audio 模板保持纯净，不包含任何 video 特定代码
- index.html 不应提交到 git，它是在分析时动态生成的

调用方式:
    # 在 analyze_video_project.py 的 _copy_visualization_template 方法中调用
    from app.tools.magic_video.generate_index import generate_video_index
    
    result = generate_video_index(
        template_path='../magic_audio/index.html',
        implementation_path='./media-player-implementation.js',
        output_path=str(project_path / 'index.html'),
        title='超级麦吉视频播放器',
        verbose=False
    )
"""

import re
from pathlib import Path
from typing import Optional


def read_file(file_path: str) -> str:
    """读取文件内容"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()


def write_file(file_path: str, content: str) -> None:
    """写入文件内容"""
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)


def extract_script_content(js_content: str) -> str:
    """
    提取 JS 文件的内容，并添加适当的缩进
    保持原有的注释和代码结构
    """
    lines = js_content.strip().split('\n')
    # 添加 8 个空格的缩进（与 audio 版本保持一致）
    indented_lines = ['        ' + line if line.strip() else '' for line in lines]
    return '\n'.join(indented_lines)


def replace_media_implementation(html_content: str, js_content: str) -> str:
    """
    替换 HTML 中的 media-player-implementation 脚本内容
    
    Args:
        html_content: 原始 HTML 内容
        js_content: 新的 JS 实现内容
    
    Returns:
        替换后的 HTML 内容
    """
    # 查找 <script id="media-player-implementation"> 到 </script> 之间的内容
    pattern = r'(<script id="media-player-implementation">)(.*?)(</script>)'
    
    # 提取并格式化 JS 内容
    formatted_js = extract_script_content(js_content)
    
    # 替换内容
    replacement = r'\1\n' + formatted_js + '\n    ' + r'\3'
    
    result = re.sub(pattern, replacement, html_content, flags=re.DOTALL)
    
    if result == html_content:
        raise ValueError("未找到 <script id=\"media-player-implementation\"> 标签，替换失败")
    
    return result


def replace_title(html_content: str, new_title: str) -> str:
    """
    替换 HTML 中的 <title> 标签内容
    只替换 <head> 标签内的第一个 <title>，不影响错误页面中的 <title>
    
    Args:
        html_content: 原始 HTML 内容
        new_title: 新的标题
    
    Returns:
        替换后的 HTML 内容
    """
    # 只替换第一个 <title> 标签（即 <head> 中的主标题）
    pattern = r'(<title>)(.*?)(</title>)'
    replacement = r'\1' + new_title + r'\3'
    
    # 使用 count=1 只替换第一个匹配项
    result = re.sub(pattern, replacement, html_content, count=1, flags=re.IGNORECASE)
    
    if result == html_content:
        print("⚠️  警告: 未找到 <title> 标签，标题替换失败")
        return html_content
    
    return result


def remove_audio_tag(html_content: str) -> str:
    """
    删除 HTML 中的 <audio> 标签
    用于 video 场景，因为 video 使用 iframe 而不是 audio 元素
    
    Args:
        html_content: 原始 HTML 内容
    
    Returns:
        删除 audio 标签后的 HTML 内容
    """
    # 匹配 <audio> 标签（包括多行和单行）
    pattern = r'<audio[^>]*>.*?</audio>'
    
    result = re.sub(pattern, '', html_content, flags=re.DOTALL | re.IGNORECASE)
    
    if result == html_content:
        print("⚠️  警告: 未找到 <audio> 标签")
    
    return result


def insert_video_player_container(html_content: str) -> str:
    """
    在 .custom-player 内部插入视频播放器容器
    用于 video 场景，YouTube iframe 需要一个容器来渲染
    
    样式由 media-player-implementation.js 中的 injectVideoStyles() 动态注入
    这里只插入 DOM 结构
    
    Args:
        html_content: 原始 HTML 内容
    
    Returns:
        插入视频容器后的 HTML 内容
    """
    # 查找 <div class="custom-player" style="display: none"> 后面紧跟的内容
    # 在其后插入视频播放器容器（不带内联样式，样式由 JS 动态注入）
    pattern = r'(<div class="custom-player" style="display: none">)(\s*)(<div class="player-controls">)'
    
    # 视频播放器容器 HTML（样式由 media-player-implementation.js 动态注入）
    video_container = '''
          <!-- 视频播放器容器 -->
          <div id="media-player"></div>
          '''
    
    # 替换：在 custom-player 和 player-controls 之间插入视频容器
    replacement = r'\1' + video_container + r'\2\3'
    
    result = re.sub(pattern, replacement, html_content, flags=re.DOTALL)
    
    if result == html_content:
        print("⚠️  警告: 未找到 .custom-player 插入点，视频容器插入失败")
        return html_content
    
    return result


def generate_video_index(
    template_path: Optional[str] = None,
    implementation_path: Optional[str] = None,
    output_path: Optional[str] = None,
    title: str = '超级麦吉视频播放器',
    verbose: bool = True
) -> dict:
    """
    生成 magic_video 的 index.html
    
    Args:
        template_path: 模板文件路径 (默认: ../magic_audio/index.html)
        implementation_path: 媒体实现文件路径 (默认: ./media-player-implementation.js)
        output_path: 输出文件路径 (默认: ./index.html)
        title: 生成的 HTML 标题 (默认: 超级麦吉视频播放器)
        verbose: 是否输出详细日志 (默认: True)
    
    Returns:
        dict: 包含生成结果的字典
            {
                'success': bool,
                'template_path': str,
                'implementation_path': str,
                'output_path': str,
                'title': str,
                'template_lines': int,
                'implementation_lines': int,
                'output_lines': int,
                'message': str
            }
    
    Raises:
        FileNotFoundError: 当模板文件或实现文件不存在时
        ValueError: 当替换失败时
    
    Example:
        >>> from app.tools.magic_video.generate_index import generate_video_index
        >>> result = generate_video_index(
        ...     template_path='../magic_audio/index.html',
        ...     title='我的视频播放器'
        ... )
        >>> print(result['success'])
        True
    """
    # 获取当前脚本所在目录
    script_dir = Path(__file__).parent
    
    # 定义文件路径（支持参数覆盖）
    if template_path:
        audio_index_path = Path(template_path)
        if not audio_index_path.is_absolute():
            audio_index_path = script_dir / audio_index_path
    else:
        audio_index_path = script_dir.parent / 'magic_audio' / 'index.html'
    
    if implementation_path:
        video_implementation_path = Path(implementation_path)
        if not video_implementation_path.is_absolute():
            video_implementation_path = script_dir / video_implementation_path
    else:
        video_implementation_path = script_dir / 'media-player-implementation.js'
    
    if output_path:
        video_output_path = Path(output_path)
        if not video_output_path.is_absolute():
            video_output_path = script_dir / video_output_path
    else:
        video_output_path = script_dir / 'index.html'
    
    # 检查文件是否存在
    if not audio_index_path.exists():
        raise FileNotFoundError(f"模板文件不存在: {audio_index_path}")
    
    if not video_implementation_path.exists():
        raise FileNotFoundError(f"实现文件不存在: {video_implementation_path}")
    
    # 创建输出目录（如果不存在）
    video_output_path.parent.mkdir(parents=True, exist_ok=True)
    
    if verbose:
        print(f"📖 读取模板文件: {audio_index_path}")
    html_content = read_file(str(audio_index_path))
    
    if verbose:
        print(f"📖 读取实现文件: {video_implementation_path}")
    js_content = read_file(str(video_implementation_path))
    
    if verbose:
        print("🔄 替换 media-player-implementation 内容...")
    new_html_content = replace_media_implementation(html_content, js_content)
    
    if verbose:
        print(f"📝 替换标题: {title}")
    new_html_content = replace_title(new_html_content, title)
    
    if verbose:
        print("🗑️  删除 audio 标签...")
    new_html_content = remove_audio_tag(new_html_content)
    
    if verbose:
        print("📦 插入视频播放器容器（使用模板中定义的样式）...")
    new_html_content = insert_video_player_container(new_html_content)
    
    if verbose:
        print(f"💾 写入输出文件: {video_output_path}")
    write_file(str(video_output_path), new_html_content)
    
    # 统计信息
    html_lines = len(html_content.split('\n'))
    js_lines = len(js_content.split('\n'))
    output_lines = len(new_html_content.split('\n'))
    
    result = {
        'success': True,
        'template_path': str(audio_index_path),
        'implementation_path': str(video_implementation_path),
        'output_path': str(video_output_path),
        'title': title,
        'template_lines': html_lines,
        'implementation_lines': js_lines,
        'output_lines': output_lines,
        'message': '生成完成'
    }
    
    if verbose:
        print("\n✅ 生成完成!")
        print(f"   - 模板文件: {html_lines} 行")
        print(f"   - 实现文件: {js_lines} 行")
        print(f"   - 输出文件: {output_lines} 行")
        print(f"   - 标题: {title}")
        print(f"   - 输出路径: {video_output_path}")
    
    return result

