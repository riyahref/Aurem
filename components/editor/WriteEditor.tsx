'use client'

import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

interface WriteEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export default function WriteEditor({ content, onChange, placeholder }: WriteEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        autolink: true,
        defaultProtocol: 'https',
        linkOnPaste: true,
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-burgundy underline decoration-2 underline-offset-2',
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class:
          'min-h-[300px] p-6 focus:outline-none font-body text-ink text-base leading-relaxed bg-[#FAF6EB] max-w-full prose prose-zinc',
      },
    },
  })

  useEffect(() => {
    if (!editor) {
      return
    }

    if (content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor) {
    return (
      <div className="min-h-[300px] bg-[#FAF6EB] border-2 border-ink rounded animate-pulse p-6">
        Winding ink ribbon...
      </div>
    )
  }

  const MenuButton = ({
    onClick,
    active,
    label,
  }: {
    onClick: () => void
    active?: boolean
    label: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 text-xs font-bold font-mono border-2 border-ink rounded transition-all cursor-pointer ${
        active
          ? 'bg-burgundy text-cream shadow-sm translate-y-[1px]'
          : 'bg-[#FAF6EB] text-ink hover:translate-y-[-1px] hover:shadow-[2px_2px_0px_var(--ink)] shadow-sm'
      }`}
    >
      {label}
    </button>
  )

  const toggleLink = () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const nextUrl = window.prompt('Paste a URL to link', previousUrl || 'https://')

    if (nextUrl === null) {
      return
    }

    if (!nextUrl.trim()) {
      editor.chain().focus().unsetLink().run()
      return
    }

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: nextUrl.trim() })
      .run()
  }

  return (
    <div className="flex flex-col border-2 border-ink rounded overflow-hidden card-retro bg-cream">
      <div className="flex flex-wrap gap-2 p-3 bg-[#EAE3D2] border-b-2 border-ink items-center">
        <span className="text-xs font-bold font-mono uppercase text-zinc-600 mr-2 select-none">
          TYPEWRITER:
        </span>
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          label="BOLD"
        />
        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          label="ITALIC"
        />
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          label="H3"
        />
        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          label="BULLET"
        />
        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          label="NUMBER"
        />
        <MenuButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          label="QUOTE"
        />
        <MenuButton
          onClick={toggleLink}
          active={editor.isActive('link')}
          label="LINK"
        />
        <div className="flex-1" />
        <MenuButton onClick={() => editor.chain().focus().undo().run()} label="UNDO" />
        <MenuButton onClick={() => editor.chain().focus().redo().run()} label="REDO" />
      </div>

      <div className="relative bg-[#FAF6EB]">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.7) 1px, transparent 1px)',
            backgroundSize: '100% 28px',
          }}
        />

        {editor.isEmpty && placeholder && (
          <div className="pointer-events-none absolute left-6 top-6 z-10 max-w-[70%] text-zinc-400">
            {placeholder}
          </div>
        )}

        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
