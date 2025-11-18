import { useEffect, useRef } from 'react';
import { useChatContext } from '../context/useChatContext';
import type { ChatMessage, DataSource, Channel } from '../types/chat';
import { UserIcon, CpuChipIcon } from '@heroicons/react/24/outline';

export function ChatArea() {
  const { messages, dataSources, channels } = useChatContext() as { 
    messages: ChatMessage[], 
    dataSources: DataSource[], 
    channels: Channel[] 
  };
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Show all messages and only keep the latest streaming message for each stream
  const recentMessages = messages.filter((msg, _, arr) => {
    // For streaming messages, only keep the latest one (the one with the highest index in the array)
    if (msg.id.startsWith('stream-') || msg.id.startsWith('explanation-')) {
      const streamBaseId = msg.id.split('-').slice(0, 2).join('-'); // Extract base stream ID
      const streamMessages = arr.filter(m => m.id.startsWith(streamBaseId));
      return streamMessages.indexOf(msg) === streamMessages.length - 1;
    }
    return true;
  });

  useEffect(() => {
    if (bottomRef.current && containerRef.current) {
      const isAtBottom = containerRef.current.scrollHeight - containerRef.current.scrollTop === containerRef.current.clientHeight;
      if (isAtBottom) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  }, [recentMessages]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (bottomRef.current && recentMessages.length > 0) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      }, 100);
    }
  }, [recentMessages.length]);

  return (
    <div ref={containerRef} className="overflow-y-auto p-6 space-y-6 max-h-[70vh] will-change-auto" style={{ transform: 'translateZ(0)' }}>
      {(dataSources.length > 0 || channels.length > 0) && recentMessages.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex flex-wrap gap-4 text-xs">
            {dataSources.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="font-medium text-blue-800 dark:text-blue-200">Data Sources:</span>
                <span className="text-blue-700 dark:text-blue-300">{dataSources.join(', ')}</span>
              </div>
            )}
            {channels.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="font-medium text-blue-800 dark:text-blue-200">Channels:</span>
                <span className="text-blue-700 dark:text-blue-300">{channels.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}
      {recentMessages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
          <div className="p-4 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full mb-4">
            <CpuChipIcon className="w-12 h-12 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="max-w-lg space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Welcome to Perplexity Chat</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Generate AI-powered campaign payloads by following these steps:
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-left">
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li><strong>Select Data Sources</strong> from the left sidebar (Shopify, Google Ads, Facebook)</li>
                <li><strong>Choose Channels</strong> for delivery (Email, SMS, WhatsApp, Ads)</li>
                <li><strong>Type your campaign idea</strong> in the input below</li>
                <li><strong>Click "Generate"</strong> to see the streaming JSON payload</li>
              </ol>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              The JSON will show: right audience, right channel, right message, right time
            </p>
            {(dataSources.length > 0 || channels.length > 0) && (
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Currently Selected:</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {dataSources.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Data Sources:</span>
                      <span className="text-green-700 dark:text-green-300">
                        {dataSources.join(', ')}
                      </span>
                    </div>
                  )}
                  {channels.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Channels:</span>
                      <span className="text-green-700 dark:text-green-300">
                        {channels.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {recentMessages.map((msg, index) => (
        <div
          key={msg.id}
          className={`flex gap-3 animate-in slide-in-from-bottom-4 duration-300 ${
            msg.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
          style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
        >
          {msg.role === 'system' && (
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
              <CpuChipIcon className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            {msg.role === 'system' && (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">
                  {msg.id.startsWith('explanation-') ? 'Strategy Analysis' : 'Campaign Payload'}
                </span>
                {msg.streaming && (
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                )}
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
              </div>
            )}
            <div
              className={`rounded-2xl px-4 py-3 shadow-lg ${
                msg.role === 'user'
                  ? 'ml-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                  : 'mr-auto bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
              } ${msg.streaming ? 'animate-pulse' : ''}`}
            >
              {msg.role === 'system' ? (
                msg.id.startsWith('explanation-') ? (
                  <div className="text-sm leading-relaxed font-sans">
                    <div dangerouslySetInnerHTML={{
                      __html: msg.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/^• /gm, '<span class="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2 flex-shrink-0"></span>')
                        .replace(/^(\d+)\. /gm, (_, number) => `<span class="inline-block w-5 h-5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs rounded-full mr-2 flex-shrink-0 text-center leading-5">${number}</span>`)
                        .replace(/\n/g, '<br>')
                    }} />
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border">
                    {msg.content}
                  </pre>
                )
              ) : (
                <div className="text-sm leading-relaxed">
                  {msg.content}
                </div>
              )}
            </div>
          </div>
          {msg.role === 'user' && (
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
