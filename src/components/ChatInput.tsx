import { useRef, useState, useEffect } from 'react';
import { useChatContext } from '../context/useChatContext';
import type { ChatMessage, CampaignPayload, DataSource, Channel } from '../types/chat';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';

function parsePromptToPayload(prompt: string, selectedDataSources: DataSource[], selectedChannels: string[]): CampaignPayload {
  const lowerPrompt = prompt.toLowerCase();

  // --- Campaign Name Logic (100% Dynamic) ---
  let campaignName = "Custom Campaign";
  const channelLabel = selectedChannels.length > 0 ? selectedChannels.join(' + ') : '';
  if (lowerPrompt.includes("anniversary") || lowerPrompt.includes("thank you")) {
    campaignName = `Anniversary Thank You: ${channelLabel || 'Multi-Channel'}`;
  } else if (lowerPrompt.includes("winback") || lowerPrompt.includes("win back")) {
    campaignName = `Winback: ${channelLabel || 'Multi-Channel'}`;
  } else if (lowerPrompt.includes("product launch") || lowerPrompt.includes("new product")) {
    campaignName = `Product Launch: ${channelLabel || 'Multi-Channel'}`;
  } else if (lowerPrompt.includes("loyalty") || lowerPrompt.includes("vip offer") || (lowerPrompt.includes("vip") && !lowerPrompt.includes("exclusive access"))) {
    campaignName = `Loyalty Reward: ${channelLabel || 'Multi-Channel'}`;
  } else if (lowerPrompt.includes("cart") || lowerPrompt.includes("retarget") || lowerPrompt.includes("abandon")) {
    campaignName = `Cart Reminder: ${channelLabel || 'Multi-Channel'}`;
  } else if (lowerPrompt.includes("flash sale") || lowerPrompt.includes("discount")) {
    const percentMatch = lowerPrompt.match(/(\d{1,2})%/);
    campaignName = `Flash Sale: ${channelLabel || 'Multi-Channel'}${percentMatch ? ` (${percentMatch[1]}% OFF)` : ''}`;
  } else if (lowerPrompt.includes("exclusive access") || (lowerPrompt.includes("vip") && lowerPrompt.includes("exclusive"))) {
    campaignName = `VIP Early Access: ${channelLabel || 'Email Only'}`;
  } else if (lowerPrompt.includes("re-engage") || lowerPrompt.includes("reengage") || lowerPrompt.includes("re-engagement")) {
    campaignName = `Re-engagement: ${channelLabel || 'Multi-Channel'}`;
  } else if (prompt.length > 0) {
    campaignName = prompt.charAt(0).toUpperCase() + prompt.slice(1);
  }

  // --- Centralized Offer Library ---
  let selectedOffer = undefined;
  let discountCode = undefined;
  let discountValue = undefined;
  const offersLibrary: Record<string, { code: string; value: string }> = {};
  // Extract discount code
  const discountMatch = lowerPrompt.match(/discount code\s*:?\s*([A-Z0-9]+)/i);
  if (discountMatch) {
    discountCode = discountMatch[1].toUpperCase();
  }
  // Extract discount value
  const percentMatch = lowerPrompt.match(/(\d{1,2})%/);
  if (percentMatch) {
    discountValue = percentMatch[1] + '%';
  }
  // Build offersLibrary if code/value found
  if (discountCode && discountValue) {
    offersLibrary[discountCode] = { code: discountCode, value: discountValue };
    selectedOffer = discountCode;
  } else if (discountCode) {
    offersLibrary[discountCode] = { code: discountCode, value: '10%' };
    selectedOffer = discountCode;
  } else if (discountValue) {
    // Try to infer code from context
    let code = 'OFFER' + discountValue.replace('%', '');
    offersLibrary[code] = { code, value: discountValue };
    selectedOffer = code;
  }

  // Data sources based on prompt
  const promptDataSources: DataSource[] = [];
  
    // --- Offer Block Logic (Finalized) ---
    // Add offer for Loyalty, Reminder, Discount, Flash Sale, Re-engagement (default to 10% if not specified), but NOT for exclusive access campaigns
    if (
      (lowerPrompt.includes('discount') || lowerPrompt.includes('reminder') || lowerPrompt.includes('loyalty') || (lowerPrompt.includes('vip') && !lowerPrompt.includes('exclusive access')) || campaignName.toLowerCase().includes('loyalty') || campaignName.toLowerCase().includes('reminder') || campaignName.toLowerCase().includes('flash sale') || campaignName.toLowerCase().includes('re-engagement'))
      && !lowerPrompt.includes('exclusive access')
    ) {
      if (!selectedOffer) {
        // Try to infer code/value
        let code = discountCode || 'REWARD10';
        let value = discountValue || '10%';
        offersLibrary[code] = { code, value };
        selectedOffer = code;
      }
    }
  if (lowerPrompt.includes("shopify") || lowerPrompt.includes("vip") || lowerPrompt.includes("repeat customers")) promptDataSources.push("Shopify");
  if (lowerPrompt.includes("facebook")) promptDataSources.push("Facebook Page");
  if (lowerPrompt.includes("google")) promptDataSources.push("Google Ads Tag");
  // For retargeting, add both
  if (campaignName === "Email → SMS → Ads Retargeting") {
    if (!promptDataSources.includes("Facebook Page")) promptDataSources.push("Facebook Page");
    if (!promptDataSources.includes("Google Ads Tag")) promptDataSources.push("Google Ads Tag");
  }
  // Merge with selectedDataSources, dedupe
  const mergedDataSources = Array.from(new Set([...promptDataSources, ...selectedDataSources]));

  // Parse channels from prompt as well
  const promptChannels: string[] = [];
  if (lowerPrompt.includes("email")) promptChannels.push("Email");
  if (lowerPrompt.includes("sms")) promptChannels.push("SMS");
  if (lowerPrompt.includes("whatsapp")) promptChannels.push("WhatsApp");
  if (lowerPrompt.includes("ads")) promptChannels.push("Ads");
  // Merge with selectedChannels, dedupe
  const mergedChannels = Array.from(new Set([...promptChannels, ...selectedChannels]));
  const workflow: CampaignPayload['workflow'] = [];
  const scheduleObj = { datetime: "2025-09-30T10:00:00.000Z", localTime: true, timezone: "customer_local" };
  mergedChannels.forEach((channel) => {
    let templateRef = selectedOffer ? "flashsale_email_v1" : "generic_email_v1";
    if (channel === "SMS") templateRef = "winback_sms_v1";
    if (channel === "WhatsApp") templateRef = "cart_whatsapp_v1";
    const step: CampaignPayload['workflow'][0] = {
      channel: channel as Channel,
      templateRef,
      schedule: scheduleObj,
      offer: selectedOffer,
    };
    if (channel === "SMS" || channel === "WhatsApp") step.requiresOptIn = true;
    if (channel === "Ads") step.platforms = ["Facebook", "Google"];
    workflow.push(step);
  });
  // Optional Experimentation (A/B Testing)
  let experiment = undefined;
  if (lowerPrompt.includes("a/b test") || lowerPrompt.includes("experiment")) {
    experiment = {
      variantA: "flashsale_email_v1",
      variantB: "flashsale_email_v2",
      split: 0.5
    };
  }

  // --- Tracking: allow prompt-driven or default goals ---
  // tracking is now handled as template fields in the payload

  // --- Compliance: flatten to top-level booleans ---
  const compliance: CampaignPayload['compliance'] = {
    smsOptInRequired: mergedChannels.includes("SMS"),
    whatsappOptInRequired: mergedChannels.includes("WhatsApp")
  };

  // --- Success Criteria Logic (Always Parameterized) ---
  let conversionRateTarget = ">= 0.05";
  let clickRateTarget = ">= 0.1";
  // Loyalty prompt override
  if (lowerPrompt.includes("loyalty") && lowerPrompt.match(/(\d+)%/g)) {
    const matches = lowerPrompt.match(/(\d+)%/g);
    if (matches && matches.length >= 2) {
      conversionRateTarget = `>= ${parseFloat(matches[0]) / 100}`;
      clickRateTarget = `>= ${parseFloat(matches[1]) / 100}`;
    }
  } else if (lowerPrompt.match(/conversion rate\s*>=?\s*(\d+)%/)) {
    const conv = lowerPrompt.match(/conversion rate\s*>=?\s*(\d+)%/);
    if (conv) conversionRateTarget = `>= ${parseFloat(conv[1]) / 100}`;
  } else if (lowerPrompt.match(/click rate\s*>=?\s*(\d+)%/)) {
    const click = lowerPrompt.match(/click rate\s*>=?\s*(\d+)%/);
    if (click) clickRateTarget = `>= ${parseFloat(click[1]) / 100}`;
  }

  // --- Audience Segments: reusable filter param ---
  const audienceSegments = [];
  if (mergedDataSources.includes("Shopify")) {
    audienceSegments.push({ source: "Shopify", filter: "{{audience.lastPurchaseOverDays}}" });
  }
  if (mergedDataSources.includes("Facebook Page")) {
    audienceSegments.push({ source: "Facebook Page", filter: "{{audience.clickedLast30d}}" });
  }
  if (mergedDataSources.includes("Google Ads Tag")) {
    audienceSegments.push({ source: "Google Ads Tag", filter: "{{audience.cartAbandoned}}" });
  }

  // --- Message Frequency Control by Channel ---
  let perChannel: Record<string, number> = {};
  if (lowerPrompt.includes("email") && lowerPrompt.includes("sms")) {
    perChannel = { Email: 2, SMS: 1 };
  } else if (lowerPrompt.includes("email")) {
    perChannel = { Email: 2 };
  } else if (lowerPrompt.includes("sms")) {
    perChannel = { SMS: 1 };
  }

  const payload: CampaignPayload = {
    campaignId: `campaign_${Date.now()}`,
    campaignName,
    audience: { segments: audienceSegments },
    workflow,
    dataSources: mergedDataSources,
    tracking: {
      openRate: "{{trackOpen}}",
      clickRate: "{{trackClick}}",
      conversion: "{{trackConversion}}"
    },
    successCriteria: {
      conversionRateTarget,
      clickRateTarget
    },
    compliance,
    limits: { maxMessagesPerUser: 3, perChannel },
    offer: selectedOffer,
    offersLibrary: Object.keys(offersLibrary).length > 0 ? offersLibrary : undefined
  };
  if (experiment) {
    payload.experiment = experiment;
  }
  if (lowerPrompt.includes("us") && lowerPrompt.includes("mx")) {
    payload.localization = ["US", "MX"];
  }
  return payload;
}

function generatePayloadExplanation(payload: CampaignPayload, prompt: string): string {
  // Analyze prompt for key themes
  const promptLower = prompt.toLowerCase();
  const isReengagement = promptLower.includes('re-engage') || promptLower.includes('inactive') || promptLower.includes('haven\'t purchased') || promptLower.includes('lapsed') || promptLower.includes('winback') || promptLower.includes('churn') || promptLower.includes('dormant') || promptLower.includes('bring back');
  const isPromotional = promptLower.includes('sale') || promptLower.includes('discount') || promptLower.includes('offer') || promptLower.includes('promotion') || promptLower.includes('deal') || promptLower.includes('special') || promptLower.includes('flash');
  const isSeasonal = promptLower.includes('holiday') || promptLower.includes('seasonal') || promptLower.includes('christmas') || promptLower.includes('black friday') || promptLower.includes('season') || promptLower.includes('event');
  const isRetention = promptLower.includes('retention') || promptLower.includes('loyalty') || promptLower.includes('keep') || promptLower.includes('maintain') || promptLower.includes('vip') || promptLower.includes('loyal');
  const isAcquisition = promptLower.includes('new customer') || promptLower.includes('acquire') || promptLower.includes('attract') || promptLower.includes('prospect') || promptLower.includes('acquisition');

  // Determine campaign type with better priority
  let campaignType = 'General Marketing';
  if (isReengagement) campaignType = 'Re-engagement';
  else if (isRetention) campaignType = 'Retention';
  else if (isAcquisition) campaignType = 'Acquisition';
  else if (isSeasonal) campaignType = 'Seasonal';
  else if (isPromotional) campaignType = 'Promotional';

  // Dynamic audience description based on prompt analysis
  let audienceDescription = 'Targeted audience based on your specified criteria';
  if (isReengagement) {
    audienceDescription = 'Customers who haven\'t engaged recently, identified through purchase behavior analysis';
  } else if (isAcquisition) {
    audienceDescription = 'Potential new customers matching your ideal profile characteristics';
  } else if (isRetention) {
    audienceDescription = 'Existing valuable customers to maintain engagement and loyalty';
  }

  // Dynamic channel recommendation
  let channelRationale = 'Selected for optimal reach and engagement based on your audience';
  const workflowChannels = payload.workflow.map(w => w.channel);
  if (workflowChannels.includes('Email')) {
    channelRationale = 'Email chosen for detailed messaging and personalized communication';
  } else if (workflowChannels.includes('SMS')) {
    channelRationale = 'SMS selected for immediate, high-impact notifications';
  } else if (workflowChannels.includes('WhatsApp')) {
    channelRationale = 'WhatsApp chosen for conversational, personal touchpoints';
  }

  // Dynamic timing rationale
  let timingRationale = 'Scheduled for optimal audience availability';
  if (isReengagement) {
    timingRationale = 'Timed to catch customers when they\'re most likely to reconsider engagement';
  } else if (isPromotional) {
    timingRationale = 'Scheduled during peak shopping periods for maximum impact';
  } else if (isSeasonal) {
    timingRationale = 'Aligned with seasonal shopping patterns and calendar events';
  }

  // Dynamic recommendations based on campaign type
  let recommendations = [];
  if (isReengagement) {
    recommendations = [
      'Start with low-frequency messaging to avoid overwhelming inactive users',
      'Monitor re-engagement rates closely and adjust messaging based on response',
      'Consider progressive incentives starting with simple re-engagement offers',
      'Track long-term behavior changes beyond initial re-engagement metrics'
    ];
  } else if (isPromotional) {
    recommendations = [
      'Track conversion rates and adjust offer value based on performance',
      'Consider A/B testing different incentives and messaging approaches',
      'Monitor inventory levels and adjust campaign pacing accordingly',
      'Analyze customer segments that respond best to promotional offers'
    ];
  } else if (isSeasonal) {
    recommendations = [
      'Time sensitivity is critical - monitor inventory levels and adjust messaging',
      'Consider pre-season teaser campaigns to build anticipation',
      'Track seasonal conversion patterns for future campaign optimization',
      'Plan post-season follow-up campaigns to maintain momentum'
    ];
  } else {
    recommendations = [
      'Test with a small audience segment first, then scale based on performance',
      'Monitor engagement rates closely and adjust targeting parameters',
      'Consider A/B testing different messaging approaches',
      'Track ROI and optimize campaign elements based on data insights'
    ];
  }

  const explanation = `📊 **Campaign Analysis**

You requested: "${prompt}"

This is a **${campaignType.toLowerCase()}** campaign using **${payload.dataSources.length > 0 ? payload.dataSources.join(' + ') : 'selected'}** data source${payload.dataSources.length > 1 ? 's' : ''} with **${payload.workflow.length > 0 ? payload.workflow.map(w => w.channel).join(' + ') : 'selected'}** communication channel${payload.workflow.length > 1 ? 's' : ''}.

🎯 **Campaign Details**  
• Campaign ID: ${payload.campaignId}  
• Campaign Name: ${payload.campaignName}

👥 **Audience Strategy**  
Audience targeting leverages **${payload.dataSources.length > 0 ? payload.dataSources.join(', ') : 'selected data sources'}** to reach ${audienceDescription.toLowerCase()}.

🚀 **Execution Approach**  
The execution strategy centers on **${payload.workflow[0]?.channel || 'selected channel'}**, ${channelRationale.toLowerCase()}.

⏰ **Timing & Scheduling**  
Timing is set for **${payload.workflow[0]?.schedule?.datetime ? new Date(payload.workflow[0]?.schedule.datetime).toLocaleString() : 'immediate execution'}**, ${timingRationale.toLowerCase()}.

💰 **Incentive Structure**  
${payload.workflow[0]?.offer ? `An offer code **${payload.workflow[0].offer}** has been incorporated to drive engagement.` : 'No specific offer has been configured for this campaign.'}

📈 **Performance Objectives**  
Success will be measured against **conversion targets of ${payload.successCriteria?.conversionRateTarget || '5%'}** and **click rate targets of ${payload.successCriteria?.clickRateTarget || '10%'}**. Comprehensive tracking includes open rates, click rates, and conversions.

⚖️ **Compliance Framework**  
Compliance measures include a maximum of **${payload.limits?.maxMessagesPerUser || 3} messages per user** to maintain deliverability standards.

💡 **Strategic Recommendations**  
${recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}`;

  return explanation;
}

export function ChatInput() {
  const { addMessage, setStreamingPayload, currentChatId, dataSources, channels, createNewChat, shouldStopStreaming } = useChatContext() as {
    addMessage: (msg: ChatMessage, chatId?: string) => void;
    setStreamingPayload: (payload: CampaignPayload) => void;
    currentChatId: string | null;
    dataSources: DataSource[];
    channels: string[];
    createNewChat: () => string;
    shouldStopStreaming: boolean;
  };
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const shouldStopRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const pausedStateRef = useRef<{
    jsonIndex: number;
    explanationIndex: number;
    streamedJson: string;
    streamedExplanation: string;
    streamId: string;
    explanationId: string;
    payload: any;
    userInput: string;
  } | null>(null);

  // Load paused state from localStorage when currentChatId changes
  useEffect(() => {
    if (currentChatId) {
      const savedPausedState = localStorage.getItem(`chatPausedState_${currentChatId}`);
      if (savedPausedState) {
        try {
          const parsedState = JSON.parse(savedPausedState);
          pausedStateRef.current = parsedState;
          setIsPaused(true);
        } catch (error) {
          console.error('Failed to load paused state:', error);
          localStorage.removeItem(`chatPausedState_${currentChatId}`);
          setIsPaused(false);
          pausedStateRef.current = null;
        }
      } else {
        setIsPaused(false);
        pausedStateRef.current = null;
      }
    } else {
      setIsPaused(false);
      pausedStateRef.current = null;
    }
  }, [currentChatId]);

  // Stop streaming when global stop signal is received
  useEffect(() => {
    if (shouldStopStreaming) {
      shouldStopRef.current = true;
      setLoading(false);
      // Clear any paused state when globally stopping
      setIsPaused(false);
      pausedStateRef.current = null;
      if (currentChatId) {
        localStorage.removeItem(`chatPausedState_${currentChatId}`);
      }
    }
  }, [shouldStopStreaming, currentChatId]);

  const handleSend = async () => {
    if (!input.trim() && !pausedStateRef.current) return;
    setLoading(true);
    shouldStopRef.current = false;
    setIsPaused(false);

    // Ensure a chat exists
    let chatId = currentChatId;
    if (!chatId) {
      chatId = createNewChat();
    }

    let userInput = input;
    let payload: any;

    // If resuming, use saved state
    if (pausedStateRef.current) {
      userInput = pausedStateRef.current.userInput;
      payload = pausedStateRef.current.payload;
    } else {
      // New generation - add user message
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: input,
        timestamp: new Date().toISOString(),
      };
      addMessage(userMsg, chatId);
      setInput('');
      inputRef.current?.focus();

      payload = parsePromptToPayload(input, dataSources, channels);
      setStreamingPayload(payload);
    }

    const jsonStr = JSON.stringify(payload, null, 2);
    const streamId = pausedStateRef.current?.streamId || `stream-${Date.now()}`;
    let streamed = pausedStateRef.current?.streamedJson || '';
    let startIndex = pausedStateRef.current?.jsonIndex || 0;

    for (let i = startIndex; i < jsonStr.length; i++) {
      if (shouldStopRef.current) {
        // Save paused state
        pausedStateRef.current = {
          jsonIndex: i,
          explanationIndex: 0,
          streamedJson: streamed,
          streamedExplanation: '',
          streamId: streamId,
          explanationId: '',
          payload,
          userInput,
        };
        setIsPaused(true);
        localStorage.setItem(`chatPausedState_${chatId}`, JSON.stringify(pausedStateRef.current));
        break;
      }
      streamed += jsonStr[i];
      await new Promise((r) => setTimeout(r, 20));

      if (i % 5 === 0 || i === jsonStr.length - 1) {
        const isComplete = i === jsonStr.length - 1 || shouldStopRef.current;
        addMessage({
          id: `${streamId}-${i}`,
          role: 'system',
          content: streamed,
          timestamp: new Date().toISOString(),
          streaming: !isComplete,
        }, chatId);
      }
    }

    if (!shouldStopRef.current) {
      setLoading(false);

      // Add explanation message with streaming effect
      const explanation = generatePayloadExplanation(payload, userInput);
      const explanationId = pausedStateRef.current?.explanationId || `explanation-${Date.now()}`;
      let streamedExplanation = pausedStateRef.current?.streamedExplanation || '';
      let explanationStartIndex = pausedStateRef.current?.explanationIndex || 0;

      for (let i = explanationStartIndex; i < explanation.length; i++) {
        if (shouldStopRef.current) {
          // Save paused state for explanation
          pausedStateRef.current = {
            jsonIndex: jsonStr.length,
            explanationIndex: i,
            streamedJson: streamed,
            streamedExplanation,
            streamId: streamId,
            explanationId: explanationId,
            payload,
            userInput,
          };
          setIsPaused(true);
          localStorage.setItem(`chatPausedState_${chatId}`, JSON.stringify(pausedStateRef.current));
          break;
        }
        streamedExplanation += explanation[i];
        await new Promise((r) => setTimeout(r, 15)); // Slightly faster than JSON for premium feel

        if (i % 10 === 0 || i === explanation.length - 1) {
          const isComplete = i === explanation.length - 1 || shouldStopRef.current;
          addMessage({
            id: `${explanationId}-${i}`,
            role: 'system',
            content: streamedExplanation,
            timestamp: new Date().toISOString(),
            streaming: !isComplete,
          }, chatId);
        }
      }
    }

    // Clear paused state if completed
    if (!shouldStopRef.current) {
      pausedStateRef.current = null;
      if (currentChatId) {
        localStorage.removeItem(`chatPausedState_${currentChatId}`);
      }
      setInput(''); // Clear input after successful completion
    }

    setLoading(false);
  };

  const handleStop = () => {
    shouldStopRef.current = true;
    setLoading(false);
    // Save paused state to localStorage
    if (pausedStateRef.current && currentChatId) {
      localStorage.setItem(`chatPausedState_${currentChatId}`, JSON.stringify(pausedStateRef.current));
    }
  };

  const handleResume = () => {
    if (pausedStateRef.current && currentChatId) {
      setIsPaused(false);
      shouldStopRef.current = false;
      // Clear paused state from localStorage
      localStorage.removeItem(`chatPausedState_${currentChatId}`);
      handleSend();
    }
  };

  return (
    <form
      className="flex gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        handleSend();
      }}
    >
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 shadow-sm transition-all duration-200"
          placeholder="Describe your campaign idea..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          required
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
          </div>
        )}
      </div>
      <button
        type="submit"
        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        disabled={loading || !input.trim()}
      >
        <span>{loading ? 'Generating...' : 'Generate'}</span>
        <PaperAirplaneIcon className="w-4 h-4" />
      </button>
      {loading && (
        <button
          type="button"
          onClick={handleStop}
          className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
        >
          <span>Stop</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      )}
      {isPaused && (
        <button
          type="button"
          onClick={handleResume}
          className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
        >
          <span>Resume</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l.707.707A1 1 0 0012.414 11H15m-3 7.5A9.5 9.5 0 1121.5 12 9.5 9.5 0 0112 2.5z" />
          </svg>
        </button>
      )}
    </form>
  );
}
