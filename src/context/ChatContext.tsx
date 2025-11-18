import { useState, useEffect, type ReactNode } from 'react';
import type { ChatMessage, DataSource, Channel, CampaignPayload, ChatSession } from '../types/chat';
import { ChatContext } from './ChatContextObject';

function loadInitialChatsAndId() {
  let chats: ChatSession[] = [];
  let chatId: string | null = null;
  try {
    const saved = localStorage.getItem('chatSessions');
    if (saved) {
      chats = JSON.parse(saved);
      if (chats.length > 0) {
        const lastId = localStorage.getItem('currentChatId');
        if (lastId && chats.some(c => c.id === lastId)) chatId = lastId;
        else chatId = chats[0].id;
      }
    }
  } catch (e) {
    console.error('Error loading chatSessions from localStorage:', e);
    // Don't create fallback chat, just use empty state
    chats = [];
    chatId = null;
  }
  return { chats, chatId };
}

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const initial = loadInitialChatsAndId();
  const [chats, setChats] = useState<ChatSession[]>(initial.chats);
  const [currentChatId, setCurrentChatId] = useState<string | null>(initial.chatId);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [streamingPayload, setStreamingPayload] = useState<CampaignPayload | null>(null);
  const [shouldStopStreaming, setShouldStopStreaming] = useState(false);

  // Persist chats and currentChatId to localStorage
  useEffect(() => {
    localStorage.setItem('chatSessions', JSON.stringify(chats));
  }, [chats]);
  useEffect(() => {
    if (currentChatId) localStorage.setItem('currentChatId', currentChatId);
  }, [currentChatId]);

  const createNewChat = () => {
    const newChat: ChatSession = {
      id: `chat_${Date.now()}`,
      title: 'New Chat',
      messages: [],
      timestamp: new Date().toISOString(),
    };
    setChats((prev) => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    // Reset data sources and channels for new chat
    setDataSources([]);
    setChannels([]);
    // Clear any paused state
    localStorage.removeItem('chatPausedState');
    return newChat.id;
  };

  const selectChat = (chatId: string) => {
    setCurrentChatId(chatId);
  };

  const currentChat = chats.find((chat) => chat.id === currentChatId);

  const addMessage = (msg: ChatMessage, chatId?: string) => {
    const targetChatId = chatId || currentChatId;
    if (!targetChatId) return;
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === targetChatId
          ? {
              ...chat,
              messages: [...chat.messages, msg],
              title: chat.title === 'New Chat' && msg.role === 'user' ? msg.content.slice(0, 50) + '...' : chat.title,
            }
          : chat
      )
    );
  };

  const updateChatTitle = (chatId: string, newTitle: string) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, title: newTitle } : chat
      )
    );
  };

  const clearStreamingMessages = () => {
    if (!currentChatId) return;
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === currentChatId
          ? {
              ...chat,
              messages: chat.messages.map((msg) => ({
                ...msg,
                streaming: false,
              })),
            }
          : chat
      )
    );
  };

  const deleteChat = (chatId: string) => {
    setChats((prev) => {
      const filtered = prev.filter((chat) => chat.id !== chatId);
      // If current chat is deleted, select next available
      if (currentChatId === chatId) {
        if (filtered.length > 0) {
          setCurrentChatId(filtered[0].id);
        } else {
          setCurrentChatId(null);
        }
      }
      return filtered;
    });
  };

  const stopStreaming = () => {
    setShouldStopStreaming(true);
    // Reset after a short delay to allow components to react
    setTimeout(() => setShouldStopStreaming(false), 100);
  };

  return (
    <ChatContext.Provider
      value={{
        messages: currentChat?.messages || [],
        addMessage,
        clearStreamingMessages,
        chats,
        currentChatId,
        createNewChat,
        selectChat,
        updateChatTitle,
        deleteChat,
        dataSources,
        setDataSources,
        channels,
        setChannels,
        streamingPayload,
        setStreamingPayload,
        stopStreaming,
        shouldStopStreaming,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
