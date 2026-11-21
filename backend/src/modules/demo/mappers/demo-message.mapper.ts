import type { DemoMessage } from '../entities/demo-message.entity';
import type { DemoMessageView } from '../interfaces/demo.interfaces';

export function toDemoMessageView(message: DemoMessage): DemoMessageView {
  return {
    id: message.id,
    sender: message.sender,
    text: message.text,
    ...(message.qrString ? { qrString: message.qrString } : {}),
    ...(message.url ? { url: message.url } : {}),
    createdAt: message.createdAt.toISOString(),
  };
}
