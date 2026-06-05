import { getChatHistory } from '@/app/actions/chat';
import { ChatWorkspace } from '@/components/ChatWorkspace';

export default async function ChatPage() {
  const { chatId, messages } = await getChatHistory();
  return <ChatWorkspace initialMessages={messages} initialChatId={chatId} />;
}
