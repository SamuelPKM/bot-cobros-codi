export const DEMO_SENDERS = ['visitor', 'bot'] as const;
export type DemoSender = (typeof DEMO_SENDERS)[number];
