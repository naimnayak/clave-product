import type { ReactNode } from 'react'

/**
 * Renders the assistant's plain-text replies: paragraphs, "- " / "• " bullets and "1." lists.
 * Text is rendered as text (never as HTML), so replies can't inject markup.
 */
export function FormattedReply({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flush = () => {
    if (!list) return
    const items = list.items.map((item, i) => <li key={i}>{item}</li>)
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length} className="list-decimal space-y-1 pl-5">{items}</ol>
      ) : (
        <ul key={blocks.length} className="list-disc space-y-1 pl-5">{items}</ul>
      ),
    )
    list = null
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const bullet = /^[-•*]\s+(.*)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      const ordered = !!numbered
      if (list && list.ordered !== ordered) flush()
      list ??= { ordered, items: [] }
      list.items.push((bullet ?? numbered)![1].replace(/\*\*/g, ''))
      continue
    }
    flush()
    if (line) blocks.push(<p key={blocks.length}>{line.replace(/\*\*/g, '')}</p>)
  }
  flush()

  return <div className="flex flex-col gap-2.5">{blocks}</div>
}
