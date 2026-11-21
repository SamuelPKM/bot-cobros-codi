export interface ChatSegment {
  text: string;
  bold: boolean;
}

/** El bot escribe como en WhatsApp: *texto* va en negritas. Sin HTML: solo segmentos. */
export function chatSegments(text: string): ChatSegment[] {
  const segments: ChatSegment[] = [];
  const pattern = /\*([^*\n]+)\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index), bold: false });
    segments.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), bold: false });
  return segments.length > 0 ? segments : [{ text, bold: false }];
}
