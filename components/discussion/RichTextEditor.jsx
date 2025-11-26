"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Code,
  Quote,
  Anchor,
  Eye,
  FileText
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { notify } from '@/components/common/GlobalNotificationManager';

// 自定义 Anchor Extension
const AnchorExtension = {
  name: 'anchor',
  addCommands() {
    return {
      insertAnchor: (anchorId) => ({ commands, tr, state }) => {
        const { selection } = state;
        const anchor = `<a id="${anchorId}"></a>`;
        tr.insertText(anchor, selection.from);
        return true;
      },
    };
  },
};

export default function RichTextEditor({ 
  content, 
  onChange, 
  placeholder = "分享你的想法、經驗或問題...",
  uploadedImages = [],
  onInsertImage 
}) {
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');

  // 简单的 HTML 转 Markdown 函数
  const htmlToMarkdown = (html) => {
    let md = html;
    // 转换标题
    md = md.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n');
    md = md.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n');
    md = md.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n');
    // 转换粗体
    md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b>(.*?)<\/b>/gi, '**$1**');
    // 转换斜体
    md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
    md = md.replace(/<i>(.*?)<\/i>/gi, '*$1*');
    // 转换代码
    md = md.replace(/<code>(.*?)<\/code>/gi, '`$1`');
    md = md.replace(/<pre><code>(.*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
    // 转换链接
    md = md.replace(/<a href="(.*?)">(.*?)<\/a>/gi, '[$2]($1)');
    // 转换列表
    md = md.replace(/<ul>(.*?)<\/ul>/gis, (match, content) => {
      return content.replace(/<li>(.*?)<\/li>/gi, '- $1\n') + '\n';
    });
    md = md.replace(/<ol>(.*?)<\/ol>/gis, (match, content) => {
      let index = 1;
      return content.replace(/<li>(.*?)<\/li>/gi, () => `${index++}. $1\n`) + '\n';
    });
    // 转换引用
    md = md.replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1\n\n');
    // 转换段落
    md = md.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');
    // 清理 HTML 标签
    md = md.replace(/<[^>]+>/g, '');
    // 清理多余换行
    md = md.replace(/\n{3,}/g, '\n\n');
    return md.trim();
  };

  // 简单的 Markdown 转 HTML 函数（改进版）
  const markdownToHtml = (md) => {
    if (!md || !md.trim()) return '';
    
    let html = md;
    
    // 先处理代码块（避免其他转换影响代码）
    const codeBlocks = [];
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
      const id = `__CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
      return id;
    });
    
    // 处理行内代码
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 转换标题（必须在段落之前）
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // 转换粗体（必须在斜体之前，避免冲突）
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // 转换斜体
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // 转换链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    
    // 转换引用
    html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
    
    // 转换列表（需要更精确的处理）
    const lines = html.split('\n');
    let inList = false;
    let listType = '';
    const processedLines = [];
    
    lines.forEach((line, index) => {
      const ulMatch = line.match(/^[\s]*[-*]\s+(.*)$/);
      const olMatch = line.match(/^[\s]*\d+\.\s+(.*)$/);
      
      if (ulMatch) {
        if (!inList || listType !== 'ul') {
          if (inList) processedLines.push(`</${listType}>`);
          processedLines.push('<ul>');
          inList = true;
          listType = 'ul';
        }
        processedLines.push(`<li>${ulMatch[1]}</li>`);
      } else if (olMatch) {
        if (!inList || listType !== 'ol') {
          if (inList) processedLines.push(`</${listType}>`);
          processedLines.push('<ol>');
          inList = true;
          listType = 'ol';
        }
        processedLines.push(`<li>${olMatch[1]}</li>`);
      } else {
        if (inList) {
          processedLines.push(`</${listType}>`);
          inList = false;
          listType = '';
        }
        if (line.trim() && !line.match(/^<[h|b|a]/)) {
          processedLines.push(`<p>${line}</p>`);
        } else if (line.trim()) {
          processedLines.push(line);
        }
      }
    });
    
    if (inList) {
      processedLines.push(`</${listType}>`);
    }
    
    html = processedLines.join('\n');
    
    // 恢复代码块
    codeBlocks.forEach((codeBlock, index) => {
      html = html.replace(`__CODE_BLOCK_${index}__`, codeBlock);
    });
    
    // 清理空段落
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/\n{3,}/g, '\n\n');
    
    return html.trim();
  };

  const editor = useEditor({
    immediatelyRender: false, // 修复 SSR hydration 错误
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-400 hover:text-blue-300 underline',
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full rounded-lg my-4',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      setMarkdownContent(htmlToMarkdown(html));
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-3 text-white',
      },
    },
  });

  useEffect(() => {
    if (editor) {
      const currentHtml = editor.getHTML();
      // 只有当内容真正改变时才更新（避免循环更新）
      if (content !== currentHtml && content !== undefined) {
        editor.commands.setContent(content || '');
        if (content) {
          setMarkdownContent(htmlToMarkdown(content));
        }
      }
    }
  }, [content, editor]);

  // 初始化 markdownContent（只在编辑器初始化时）
  useEffect(() => {
    if (editor && content && !markdownContent) {
      setMarkdownContent(htmlToMarkdown(content));
    }
  }, [editor]);

  const insertAnchor = () => {
    if (!editor) return;
    const anchorId = prompt('輸入錨點 ID（例如：section1）:');
    if (anchorId && anchorId.trim()) {
      editor.chain().focus().insertContent(`<a id="${anchorId.trim()}"></a>`).run();
    }
  };

  const insertImageTag = (index) => {
    if (!editor) return;
    editor.chain().focus().insertContent(`{{image:${index}}}`).run();
    if (onInsertImage) {
      onInsertImage(index);
    }
  };

  const generateTOC = () => {
    if (!editor) return;
    
    // 从 HTML 中提取标题
    const html = editor.getHTML();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const headings = Array.from(doc.querySelectorAll('h1, h2, h3'));
    
    if (headings.length === 0) {
      notify.warning("提示", "未找到標題，請先添加標題");
      return;
    }

    // 为标题添加 ID 并生成目录项
    const tocItems = headings.map((heading, idx) => {
      const level = parseInt(heading.tagName.charAt(1));
      const text = heading.textContent || '';
      const anchorId = heading.id || `heading-${idx}-${text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-')}`;
      
      // 为标题添加 ID（如果还没有）
      if (!heading.id) {
        heading.id = anchorId;
      }
      
      const indent = '&nbsp;&nbsp;'.repeat(level - 1);
      return `<li style="margin-left: ${(level - 1) * 1.5}rem;"><a href="#${anchorId}" class="text-blue-400 hover:text-blue-300 underline">${text}</a></li>`;
    });

    // 更新编辑器内容，包含添加了 ID 的标题
    const updatedHtml = doc.body.innerHTML;
    editor.commands.setContent(updatedHtml);

    // 生成目录 HTML
    const tocHtml = `<div class="bg-zinc-900 border border-zinc-700 rounded-lg p-4 my-4">
      <h2 class="text-xl font-bold mb-3 text-white">目錄</h2>
      <ul class="list-none space-y-1">
        ${tocItems.join('')}
      </ul>
    </div>`;
    
    // 在光标位置插入目录
    editor.chain().focus().insertContent(tocHtml).run();
  };

  const insertLink = () => {
    if (!editor) return;
    const url = prompt('輸入連結 URL:');
    if (url && url.trim()) {
      const text = prompt('輸入連結文字（可選，留空使用 URL）:') || url;
      editor.chain().focus().setLink({ href: url.trim() }).insertContent(text).run();
    }
  };

  if (!editor) {
    return <div className="border border-zinc-700 rounded-lg bg-zinc-800 p-4 text-gray-400">載入編輯器...</div>;
  }

  return (
    <div className="border border-zinc-700 rounded-lg bg-zinc-800 overflow-hidden">
      {/* 工具列 */}
      <div className="flex flex-wrap items-center gap-2 p-2 border-b border-zinc-700 bg-zinc-900/50">
        {/* 模式切换 */}
        <div className="flex items-center gap-1 mr-2 pr-2 border-r border-zinc-700">
          <button
            type="button"
            onClick={() => setShowMarkdown(!showMarkdown)}
            className={`px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1 ${
              showMarkdown 
                ? 'bg-purple-600 text-white' 
                : 'bg-zinc-700 hover:bg-zinc-600 text-gray-300'
            }`}
          >
            {showMarkdown ? <Eye className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
            {showMarkdown ? '預覽' : 'Markdown'}
          </button>
        </div>

        {/* 文字格式 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${
            editor.isActive('bold') ? 'bg-blue-600 text-white' : 'text-gray-300'
          }`}
          title="粗體 (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${
            editor.isActive('italic') ? 'bg-blue-600 text-white' : 'text-gray-300'
          }`}
          title="斜體 (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${
            editor.isActive('code') ? 'bg-blue-600 text-white' : 'text-gray-300'
          }`}
          title="行內代碼"
        >
          <Code className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-zinc-700 mx-1" />

        {/* 標題 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${
            editor.isActive('heading', { level: 1 }) ? 'bg-blue-600 text-white' : 'text-gray-300'
          }`}
          title="標題 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-blue-600 text-white' : 'text-gray-300'
          }`}
          title="標題 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${
            editor.isActive('heading', { level: 3 }) ? 'bg-blue-600 text-white' : 'text-gray-300'
          }`}
          title="標題 3"
        >
          <Heading3 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-zinc-700 mx-1" />

        {/* 列表 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${
            editor.isActive('bulletList') ? 'bg-blue-600 text-white' : 'text-gray-300'
          }`}
          title="無序列表"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${
            editor.isActive('orderedList') ? 'bg-blue-600 text-white' : 'text-gray-300'
          }`}
          title="有序列表"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${
            editor.isActive('blockquote') ? 'bg-blue-600 text-white' : 'text-gray-300'
          }`}
          title="引用"
        >
          <Quote className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-zinc-700 mx-1" />

        {/* 連結 */}
        <button
          type="button"
          onClick={insertLink}
          className={`p-2 rounded hover:bg-zinc-700 transition-colors ${
            editor.isActive('link') ? 'bg-blue-600 text-white' : 'text-gray-300'
          }`}
          title="插入連結"
        >
          <LinkIcon className="w-4 h-4" />
        </button>

        {/* 錨點 */}
        <button
          type="button"
          onClick={insertAnchor}
          className="p-2 rounded hover:bg-zinc-700 transition-colors text-gray-300"
          title="插入錨點"
        >
          <Anchor className="w-4 h-4" />
        </button>

        {/* 快速目錄 */}
        <button
          type="button"
          onClick={generateTOC}
          className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 rounded text-white transition-colors flex items-center gap-1"
          title="生成目錄（基於現有標題）"
        >
          <FileText className="w-3 h-3" />
          目錄
        </button>

        {/* 插入圖片 */}
        {uploadedImages.length > 0 && (
          <>
            <div className="w-px h-6 bg-zinc-700 mx-1" />
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 px-2">插入圖片:</span>
              {uploadedImages.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => insertImageTag(index)}
                  className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 rounded text-white transition-colors"
                  title={`插入圖片 #${index}`}
                >
                  #{index}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 編輯器內容 */}
      {showMarkdown ? (
        <div className="p-4 bg-zinc-900 min-h-[300px]">
          <textarea
            value={markdownContent}
            onChange={(e) => {
              setMarkdownContent(e.target.value);
              const html = markdownToHtml(e.target.value);
              onChange(html);
              editor.commands.setContent(html);
            }}
            placeholder="輸入 Markdown 語法..."
            className="w-full h-full min-h-[300px] bg-transparent text-white placeholder-gray-500 focus:outline-none font-mono text-sm"
          />
          <div className="mt-2 text-xs text-gray-500">
            💡 支援 Markdown 語法：**粗體**、*斜體*、# 標題、- 列表、[連結](url) 等
          </div>
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}

