function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function splitMdTableRow(line: string): string[] {
  let value = line.trim()
  if (value.startsWith('|')) value = value.slice(1)
  if (value.endsWith('|')) value = value.slice(0, -1)
  return value.split('|').map((cell) => cell.trim())
}

function isMdTableSep(line: string): boolean {
  if (!/^\s*\|?[\s:|-]+\|?\s*$/.test(line)) return false
  const cells = splitMdTableRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')))
}

function renderInline(text: string): string {
  let html = escapeHtml(text || '')
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  html = html.replace(/\[(\d{1,3})\]/g, '<span class="cite">[$1]</span>')
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline">$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  html = html.replace(/(^|[\s(«„"])\*([^*\n]+?)\*([\s).,;:!?»“"]|$)/g, '$1<em>$2</em>$3')
  return html
}

export function renderMarkdown(raw: string): string {
  const fences: string[] = []
  let source = String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  source = source.replace(/```[\w+-]*\n?([\s\S]*?)```/g, (_, code: string) => {
    const token = `%%FENCE${fences.length}%%`
    fences.push(`<pre class="md-code"><code>${escapeHtml(String(code).replace(/\n$/, ''))}</code></pre>`)
    return token
  })

  const lines = source.split('\n')
  const blocks: string[] = []
  let index = 0

  const isFence = (line: string) => /^%%FENCE\d+%%$/.test(line.trim())
  const isHeading = (line: string) => /^(#{1,4})\s+\S/.test(line)
  const isHr = (line: string) => /^\s*([-*_]){3,}\s*$/.test(line)
  const isQuote = (line: string) => /^\s*>\s?/.test(line)
  const isUl = (line: string) => /^\s*(?:[-*+]|•)\s+\S/.test(line)
  const isOl = (line: string) => /^\s*\d+[.)]\s+\S/.test(line)
  const isTableRow = (line: string) => /^\s*\|.+\|\s*$/.test(line)
  const isStandaloneBold = (line: string) => /^\s*\*\*[^*].*\*\*\s*$/.test(line)
  const isBlockStart = (line: string) =>
    !line.trim() || isFence(line) || isHeading(line) || isHr(line) || isQuote(line) || isUl(line) || isOl(line) || isTableRow(line) || isStandaloneBold(line)

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }
    if (isFence(line)) {
      blocks.push(line.trim())
      index += 1
      continue
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line)
    if (heading) {
      const level = Math.min(heading[1].length, 4)
      blocks.push(`<h${level} class="md-h md-h${level}">${renderInline(heading[2])}</h${level}>`)
      index += 1
      continue
    }
    if (isStandaloneBold(line)) {
      const title = line.trim().replace(/^\*\*/, '').replace(/\*\*\s*$/, '')
      blocks.push(`<h3 class="md-h md-h3">${renderInline(title)}</h3>`)
      index += 1
      continue
    }
    if (isHr(line)) {
      blocks.push('<hr class="md-hr" />')
      index += 1
      continue
    }
    if (isQuote(line)) {
      const quoted: string[] = []
      while (index < lines.length && isQuote(lines[index])) {
        quoted.push(lines[index].replace(/^\s*>\s?/, ''))
        index += 1
      }
      blocks.push(`<blockquote class="md-quote">${renderInline(quoted.join(' '))}</blockquote>`)
      continue
    }
    if (isTableRow(line) && index + 1 < lines.length && isMdTableSep(lines[index + 1])) {
      const header = splitMdTableRow(line)
      index += 2
      const rows: string[][] = []
      while (index < lines.length && isTableRow(lines[index])) {
        rows.push(splitMdTableRow(lines[index]))
        index += 1
      }
      const thead = `<tr>${header.map((cell) => `<th>${renderInline(cell)}</th>`).join('')}</tr>`
      const tbody = rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`).join('')
      blocks.push(`<div class="md-table-wrap"><table class="md-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`)
      continue
    }
    if (isUl(line)) {
      const items: string[] = []
      while (index < lines.length && isUl(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^\s*(?:[-*+]|•)\s+/, ''))}</li>`)
        index += 1
      }
      blocks.push(`<ul class="md-list">${items.join('')}</ul>`)
      continue
    }
    if (isOl(line)) {
      const items: string[] = []
      while (index < lines.length && isOl(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^\s*\d+[.)]\s+/, ''))}</li>`)
        index += 1
      }
      blocks.push(`<ol class="md-list">${items.join('')}</ol>`)
      continue
    }
    const para = [line]
    index += 1
    while (index < lines.length && !isBlockStart(lines[index])) {
      para.push(lines[index])
      index += 1
    }
    blocks.push(`<p>${renderInline(para.join('\n')).replace(/\n/g, '<br />')}</p>`)
  }

  let html = blocks.join('')
  fences.forEach((block, fenceIndex) => {
    html = html.replace(`%%FENCE${fenceIndex}%%`, block)
  })
  return html
}

export { escapeHtml }
