import { createContext } from 'react';
import type { ChatMessage, DataSource, Channel, CampaignPayload, ChatSession } from '../types/chat';

interface ChatContextProps {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage, chatId?: string) => void;
  clearStreamingMessages: () => void;
  chats: ChatSession[];
  currentChatId: string | null;
  createNewChat: () => string;
  selectChat: (chatId: string) => void;
  updateChatTitle: (chatId: string, newTitle: string) => void;
  deleteChat: (chatId: string) => void;
  dataSources: DataSource[];
  setDataSources: (sources: DataSource[]) => void;
  channels: Channel[];
  setChannels: (channels: Channel[]) => void;
  streamingPayload: CampaignPayload | null;
  setStreamingPayload: (payload: CampaignPayload | null) => void;
  stopStreaming: () => void;
  shouldStopStreaming: boolean;
}

export const ChatContext = createContext<ChatContextProps | undefined>(undefined);