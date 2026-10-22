/**
 * Convo Bot — AI Doubt Clearance & Enterprise Accounting Copilot
 * Font color strictly Black (#000000) and Orange (#ea580c / #f97316 / #c2410c).
 * All white fonts turned to orange.
 */
'use strict';

(function () {
  let isOpen = false;
  let isMaximized = false;
  let isTyping = false;
  let activeCategory = 'all';
  let conversationHistory = [];

  const CATEGORY_PROMPTS = {
    all: [
      'What is our current financial position and executive briefing?',
      'Show overdue customer invoices and balances',
      'What is our current month revenue & net margin?',
      'What is our current GST tax liability and ITC balance?',
      'Explain Debit vs Credit in double-entry bookkeeping',
      'How do automated bank feeds and auto-matching work?',
      'What are our SOC2 Type II & GDPR compliance safeguards?'
    ],
    accounting: [
      'What is our current financial position and executive briefing?',
      'Explain Debit vs Credit in double-entry bookkeeping',
      'What are the 3 Golden Rules of accounting?',
      'Explain Accrual basis vs Cash basis accounting',
      'Why must Debits always equal Credits in the Trial Balance?',
      'How do I record depreciation journal entries?'
    ],
    tax: [
      'How do I claim GST Input Tax Credit (ITC) without rejection?',
      'Explain Interstate (IGST) vs Intrastate (CGST+SGST) tax',
      'What are the standard Indian GST slabs and HSN/SAC codes?',
      'What is the difference between GSTR-1 and GSTR-3B filings?',
      'When is an E-Way Bill required and how is distance calculated?',
      'How does E-Invoicing IRN hash and signed QR code work?'
    ],
    banking: [
      'How do automated bank feeds and auto-matching work?',
      'How do I reconcile bank transactions with open invoices?',
      'How does integrated UPI payment collection work?',
      'What happens when a customer pays via payment link?'
    ],
    security: [
      'What are our SOC2 Type II & GDPR compliance safeguards?',
      'How do I setup Multi-Factor Authentication (MFA)?',
      'How does the immutable statutory audit trail work?',
      'How does transaction period locking protect the ledger?',
      'How do I export complete organization data under GDPR?'
    ],
    live: [
      'What is our current month revenue & net margin?',
      'Show overdue customer invoices and balances',
      'Who are our top customers by billing?',
      'Scan for active financial anomalies and risks',
      'Forecast cash flow and operating surplus for next quarter'
    ]
  };

  function injectStyles() {
    if (document.getElementById('fingpt-chat-styles')) return;
    const style = document.createElement('style');
    style.id = 'fingpt-chat-styles';
    style.textContent = `
      /* Floating Launcher Button */
      #fingpt-launcher {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        padding: 6px 10px 6px 6px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.94);
        backdrop-filter: blur(20px) saturate(180%);
        border: 1.5px solid rgba(234, 88, 12, 0.45);
        box-shadow: 0 10px 30px -5px rgba(234, 88, 12, 0.35), 0 0 15px rgba(249, 115, 22, 0.2);
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        user-select: none;
      }
      #fingpt-launcher:hover {
        transform: translateY(-3px) scale(1.03);
        box-shadow: 0 14px 35px -4px rgba(234, 88, 12, 0.5), 0 0 25px rgba(249, 115, 22, 0.35);
        border-color: #ea580c;
      }
      .fingpt-launcher-icon {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: linear-gradient(135deg, #f97316, #ea580c);
        display: grid;
        place-items: center;
        color: #000000;
        position: relative;
        box-shadow: 0 4px 12px rgba(234, 88, 12, 0.4);
      }
      .fingpt-launcher-icon svg {
        stroke: #000000;
      }
      .fingpt-launcher-pulse {
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        border: 2px solid #ea580c;
        opacity: 0.8;
        animation: fingpt-ping 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;
      }
      @keyframes fingpt-ping {
        0% { transform: scale(0.95); opacity: 0.9; }
        70%, 100% { transform: scale(1.4); opacity: 0; }
      }
      .fingpt-launcher-text {
        padding-right: 6px;
        display: flex;
        flex-direction: column;
      }
      .fingpt-launcher-title {
        font-size: 13.5px;
        font-weight: 800;
        color: #ea580c;
        line-height: 1.2;
        letter-spacing: -0.2px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .fingpt-launcher-badge {
        font-size: 9px;
        padding: 1px 6px;
        border-radius: 99px;
        background: #fff7ed;
        border: 1px solid #ea580c;
        color: #ea580c;
        font-weight: 800;
        text-transform: uppercase;
      }
      .fingpt-launcher-sub {
        font-size: 11px;
        color: #000000;
        font-weight: 600;
      }

      /* Chatbot Window Widget */
      #fingpt-widget {
        position: fixed;
        bottom: 84px;
        right: 24px;
        width: 450px;
        height: 640px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 100px);
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(28px) saturate(180%);
        border: 1.5px solid rgba(234, 88, 12, 0.35);
        border-radius: 18px;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.2), 0 0 25px rgba(234, 88, 12, 0.15);
        z-index: 99998;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        opacity: 0;
        transform: translateY(20px) scale(0.96);
        pointer-events: none;
        color: #000000;
        font-family: inherit;
      }
      #fingpt-widget.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }
      #fingpt-widget.maximized {
        top: 24px;
        left: 24px;
        right: 24px;
        bottom: 24px;
        width: auto;
        height: auto;
        max-width: none;
        max-height: none;
        border-radius: 20px;
      }

      /* Chat Header */
      .fingpt-header {
        padding: 14px 18px;
        border-bottom: 1.5px solid rgba(234, 88, 12, 0.2);
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #fff7ed;
      }
      .fingpt-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .fingpt-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #f97316, #ea580c);
        display: grid;
        place-items: center;
        color: #000000;
        font-weight: 800;
        font-size: 15px;
        box-shadow: 0 0 12px rgba(234, 88, 12, 0.4);
      }
      .fingpt-title-wrap h3 {
        margin: 0;
        font-size: 14.5px;
        font-weight: 800;
        color: #ea580c;
        letter-spacing: -0.2px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .fingpt-enterprise-badge {
        font-size: 10px;
        padding: 2px 7px;
        border-radius: 99px;
        background: #ffedd5;
        border: 1px solid rgba(234, 88, 12, 0.4);
        color: #ea580c;
        font-weight: 700;
      }
      .fingpt-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        color: #000000;
        font-weight: 600;
      }
      .fingpt-status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ea580c;
        box-shadow: 0 0 6px #ea580c;
      }
      .fingpt-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .fingpt-tool-btn {
        background: transparent;
        border: none;
        color: #000000;
        cursor: pointer;
        padding: 6px;
        border-radius: 6px;
        display: grid;
        place-items: center;
        transition: all 0.15s;
      }
      .fingpt-tool-btn:hover {
        background: #ffedd5;
        color: #ea580c;
      }
      .fingpt-tool-btn svg {
        stroke: currentColor;
      }

      /* Category Pills */
      .fingpt-categories {
        padding: 8px 14px;
        display: flex;
        gap: 6px;
        overflow-x: auto;
        white-space: nowrap;
        border-bottom: 1px solid rgba(234, 88, 12, 0.18);
        background: rgba(255, 255, 255, 0.7);
      }
      .fingpt-categories::-webkit-scrollbar { height: 3px; }
      .fingpt-categories::-webkit-scrollbar-thumb { background: rgba(234, 88, 12, 0.3); border-radius: 4px; }
      .fingpt-cat-btn {
        background: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.12);
        padding: 4px 10px;
        border-radius: 99px;
        font-size: 11.5px;
        color: #000000;
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 600;
      }
      .fingpt-cat-btn:hover {
        background: #fff7ed;
        border-color: #ea580c;
        color: #ea580c;
      }
      .fingpt-cat-btn.active {
        background: #fff7ed;
        border: 1.5px solid #ea580c;
        color: #ea580c;
        font-weight: 800;
        box-shadow: 0 2px 8px rgba(234, 88, 12, 0.18);
      }

      /* Message Feed */
      .fingpt-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        scroll-behavior: smooth;
        background: transparent;
      }
      .fingpt-messages::-webkit-scrollbar { width: 5px; }
      .fingpt-messages::-webkit-scrollbar-thumb { background: rgba(234, 88, 12, 0.3); border-radius: 4px; }

      /* Message Bubbles */
      .fingpt-msg-row {
        display: flex;
        gap: 10px;
        width: 100%;
      }
      .fingpt-msg-row.user {
        justify-content: flex-end;
      }
      .fingpt-msg-bubble {
        max-width: 88%;
        padding: 12px 16px;
        border-radius: 14px;
        font-size: 13.5px;
        line-height: 1.55;
        position: relative;
        word-break: break-word;
      }
      .fingpt-msg-row.user .fingpt-msg-bubble {
        background: #fff7ed;
        border: 1.5px solid rgba(234, 88, 12, 0.45);
        color: #ea580c;
        font-weight: 600;
        border-bottom-right-radius: 4px;
        box-shadow: 0 2px 10px rgba(234, 88, 12, 0.12);
      }
      .fingpt-msg-row.bot .fingpt-msg-bubble {
        background: #ffffff;
        border: 1px solid rgba(234, 88, 12, 0.22);
        color: #000000;
        border-bottom-left-radius: 4px;
        box-shadow: 0 3px 14px rgba(0, 0, 0, 0.05);
      }

      /* Markdown & Formatting in AI Responses (Strictly Black & Orange) */
      .fingpt-msg-bubble p {
        margin: 0 0 8px;
        color: #000000;
      }
      .fingpt-msg-bubble p:last-child {
        margin-bottom: 0;
      }
      .fingpt-msg-bubble h3 {
        font-size: 15px;
        margin: 6px 0 10px;
        font-weight: 800;
        color: #ea580c;
      }
      .fingpt-msg-bubble h4 {
        font-size: 13.5px;
        margin: 12px 0 6px;
        font-weight: 700;
        color: #ea580c;
      }
      .fingpt-msg-bubble ul, .fingpt-msg-bubble ol {
        margin: 6px 0;
        padding-left: 20px;
        color: #000000;
      }
      .fingpt-msg-bubble li {
        margin-bottom: 4px;
        color: #000000;
      }
      .fingpt-msg-bubble b, .fingpt-msg-bubble strong {
        color: #ea580c;
        font-weight: 700;
      }
      .fingpt-msg-bubble code {
        background: #fff7ed;
        border: 1px solid rgba(234, 88, 12, 0.3);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: #ea580c;
        font-weight: 600;
      }
      .fingpt-msg-bubble pre {
        background: #fff7ed;
        border: 1px solid rgba(234, 88, 12, 0.25);
        border-radius: 8px;
        padding: 10px;
        overflow-x: auto;
      }
      .fingpt-msg-bubble pre code {
        background: transparent;
        border: none;
        padding: 0;
        color: #ea580c;
      }
      .fingpt-msg-bubble table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
        font-size: 12px;
        border: 1px solid rgba(234, 88, 12, 0.25);
        border-radius: 6px;
        overflow: hidden;
      }
      .fingpt-msg-bubble th, .fingpt-msg-bubble td {
        border: 1px solid rgba(234, 88, 12, 0.2);
        padding: 6px 8px;
        text-align: left;
      }
      .fingpt-msg-bubble th {
        background: #fff7ed;
        font-weight: 700;
        color: #ea580c;
      }
      .fingpt-msg-bubble td {
        color: #000000;
      }

      /* Key Takeaways Callout */
      .fingpt-takeaways {
        margin-top: 12px;
        padding: 10px 14px;
        background: #fff7ed;
        border: 1.5px solid rgba(234, 88, 12, 0.35);
        border-radius: 8px;
      }
      .fingpt-takeaways-title {
        font-size: 12px;
        font-weight: 800;
        color: #ea580c;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .fingpt-takeaways-title svg {
        stroke: #ea580c;
      }
      .fingpt-takeaways ul {
        margin: 0;
        padding-left: 16px;
        font-size: 12px;
        color: #000000;
      }
      .fingpt-takeaways li {
        color: #000000;
      }

      /* Rule Formula Box */
      .fingpt-formula-box {
        margin-top: 10px;
        padding: 8px 12px;
        background: #fff7ed;
        border-left: 3px solid #ea580c;
        border-radius: 0 8px 8px 0;
        font-size: 12px;
        font-family: ui-monospace, monospace;
        color: #ea580c;
        font-weight: 600;
      }

      /* Action Deep-Links */
      .fingpt-actions-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 12px;
      }
      .fingpt-action-chip {
        padding: 5px 11px;
        border-radius: 6px;
        background: #fff7ed;
        border: 1px solid rgba(234, 88, 12, 0.4);
        color: #ea580c;
        font-size: 11.5px;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: all 0.15s;
      }
      .fingpt-action-chip:hover {
        background: #ffedd5;
        border-color: #ea580c;
        color: #000000;
      }
      .fingpt-action-chip svg {
        stroke: currentColor;
      }

      /* Message Toolbar (Copy, Feedback) */
      .fingpt-msg-toolbar {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px solid rgba(234, 88, 12, 0.18);
        font-size: 11px;
        color: #000000;
      }
      .fingpt-copy-btn, .fingpt-fb-btn {
        background: none;
        border: none;
        color: #000000;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 4px;
        border-radius: 4px;
        transition: color 0.15s;
        font-weight: 600;
      }
      .fingpt-copy-btn:hover, .fingpt-fb-btn:hover {
        color: #ea580c;
      }
      .fingpt-copy-btn svg, .fingpt-fb-btn svg {
        stroke: currentColor;
      }

      /* Typing Indicator Animation */
      .fingpt-typing-dots {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
      }
      .fingpt-typing-dots span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ea580c;
        animation: fingpt-bounce 1.4s infinite ease-in-out both;
      }
      .fingpt-typing-dots span:nth-child(1) { animation-delay: -0.32s; }
      .fingpt-typing-dots span:nth-child(2) { animation-delay: -0.16s; }
      @keyframes fingpt-bounce {
        0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
        40% { transform: scale(1); opacity: 1; }
      }

      /* Suggested Prompt Chips */
      .fingpt-prompts-grid {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 10px;
      }
      .fingpt-prompt-btn {
        background: #ffffff;
        border: 1px solid rgba(234, 88, 12, 0.25);
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        color: #000000;
        font-weight: 500;
        text-align: left;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .fingpt-prompt-btn svg {
        stroke: currentColor;
      }
      .fingpt-prompt-btn:hover {
        background: #fff7ed;
        border-color: #ea580c;
        color: #ea580c;
        transform: translateX(3px);
      }

      /* Chat Input Bar */
      .fingpt-input-area {
        padding: 12px 16px;
        border-top: 1.5px solid rgba(234, 88, 12, 0.2);
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .fingpt-input-row {
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }
      #fingpt-textarea {
        flex: 1;
        background: #ffffff;
        border: 1.5px solid rgba(234, 88, 12, 0.35);
        border-radius: 12px;
        padding: 10px 14px;
        color: #000000;
        font-size: 13.5px;
        line-height: 1.45;
        resize: none;
        max-height: 120px;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      #fingpt-textarea::placeholder {
        color: #000000;
        opacity: 0.6;
      }
      #fingpt-textarea:focus {
        border-color: #ea580c;
        box-shadow: 0 0 0 2px rgba(234, 88, 12, 0.2);
      }
      #fingpt-send-btn {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: linear-gradient(135deg, #f97316, #ea580c);
        border: none;
        color: #000000;
        cursor: pointer;
        display: grid;
        place-items: center;
        transition: all 0.2s;
        flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(234, 88, 12, 0.35);
      }
      #fingpt-send-btn svg {
        stroke: #000000;
      }
      #fingpt-send-btn:hover:not(:disabled) {
        transform: scale(1.05);
        box-shadow: 0 4px 16px rgba(234, 88, 12, 0.55);
      }
      #fingpt-send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .fingpt-input-hint {
        font-size: 11px;
        color: #000000;
        display: flex;
        justify-content: space-between;
      }
      .fingpt-input-hint b {
        color: #ea580c;
      }
    `;
    document.head.appendChild(style);
  }

  function createDoubtBotUI() {
    injectStyles();

    if (document.getElementById('fingpt-launcher')) return;

    const launcher = document.createElement('div');
    launcher.id = 'fingpt-launcher';
    launcher.title = 'Convo Bot · Instant Accounting & Compliance Doubt Clearance (Ctrl+K)';
    launcher.innerHTML = `
      <div class="fingpt-launcher-icon">
        <div class="fingpt-launcher-pulse"></div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
      </div>
      <div class="fingpt-launcher-text">
        <span class="fingpt-launcher-title">Convo Bot <span class="fingpt-launcher-badge">AI</span></span>
        <span class="fingpt-launcher-sub">Get Help with Accounting and Tax</span>
      </div>
    `;
    document.body.appendChild(launcher);

    const widget = document.createElement('div');
    widget.id = 'fingpt-widget';
    widget.innerHTML = `
      <!-- Header -->
      <div class="fingpt-header">
        <div class="fingpt-header-left">
          <div class="fingpt-avatar">G</div>
          <div class="fingpt-title-wrap">
            <h3>Convo Bot <span class="fingpt-enterprise-badge">Enterprise</span></h3>
            <div class="fingpt-status-pill">
              <span class="fingpt-status-dot"></span>
              <span>Accounting Assistant · Online</span>
            </div>
          </div>
        </div>
        <div class="fingpt-header-actions">
          <button class="fingpt-tool-btn" id="fingpt-reset-btn" title="New Chat / Clear Conversation" type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path></svg>
          </button>
          <button class="fingpt-tool-btn" id="fingpt-max-btn" title="Expand / Maximize Window" type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
          </button>
          <button class="fingpt-tool-btn" id="fingpt-close-btn" title="Minimize / Close" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <!-- Categories -->
      <div class="fingpt-categories">
        <button class="fingpt-cat-btn active" data-cat="all" type="button">⚡ All Doubts</button>
        <button class="fingpt-cat-btn" data-cat="accounting" type="button">📖 Accounting & Ledger</button>
        <button class="fingpt-cat-btn" data-cat="tax" type="button">🏛️ GST & Regional Tax</button>
        <button class="fingpt-cat-btn" data-cat="banking" type="button">🏦 Banking & Gateways</button>
        <button class="fingpt-cat-btn" data-cat="security" type="button">🛡️ SOC2, GDPR & Security</button>
        <button class="fingpt-cat-btn" data-cat="live" type="button">📊 Live Business Data</button>
      </div>

      <!-- Messages Stream -->
      <div class="fingpt-messages" id="fingpt-messages-stream"></div>

      <!-- Input Area -->
      <div class="fingpt-input-area">
        <div class="fingpt-input-row">
          <textarea id="fingpt-textarea" rows="1" placeholder="Ask your accounting or tax doubt..." autocomplete="off"></textarea>
          <button id="fingpt-send-btn" type="button" title="Send (Enter)">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
        <div class="fingpt-input-hint">
          <span>Press <b>Enter</b> to send, <b>Shift+Enter</b> for new line</span>
          <span>Shortcut: <b>Ctrl+K</b></span>
        </div>
      </div>
    `;
    document.body.appendChild(widget);

    renderWelcomeGreeting();

    launcher.addEventListener('click', () => toggleDoubtBot());
    $('#fingpt-close-btn').addEventListener('click', () => toggleDoubtBot(false));
    $('#fingpt-max-btn').addEventListener('click', toggleMaximize);
    $('#fingpt-reset-btn').addEventListener('click', resetChat);

    widget.addEventListener('click', (e) => {
      const catBtn = e.target.closest('.fingpt-cat-btn');
      if (catBtn) {
        $$('.fingpt-cat-btn', widget).forEach(b => b.classList.remove('active'));
        catBtn.classList.add('active');
        activeCategory = catBtn.dataset.cat || 'all';
        renderCategoryPrompts(activeCategory);
      }

      const promptBtn = e.target.closest('.fingpt-prompt-btn');
      if (promptBtn) {
        const text = promptBtn.dataset.query || promptBtn.textContent.trim();
        handleSend(text);
      }

      const actionLink = e.target.closest('.fingpt-action-chip');
      if (actionLink && actionLink.dataset.hash) {
        location.hash = actionLink.dataset.hash;
        if (!isMaximized) toggleDoubtBot(false);
      }

      const copyBtn = e.target.closest('.fingpt-copy-btn');
      if (copyBtn) {
        const bubble = copyBtn.closest('.fingpt-msg-bubble');
        if (bubble) {
          const clone = bubble.cloneNode(true);
          const toolbar = clone.querySelector('.fingpt-msg-toolbar');
          if (toolbar) toolbar.remove();
          navigator.clipboard.writeText(clone.innerText.trim()).then(() => {
            copyBtn.innerHTML = `✓ Copied`;
            setTimeout(() => { copyBtn.innerHTML = `Copy`; }, 2000);
          });
        }
      }

      const fbBtn = e.target.closest('.fingpt-fb-btn');
      if (fbBtn) {
        fbBtn.style.color = '#ea580c';
        fbBtn.textContent = '✓ Thanks for feedback!';
      }
    });

    const textarea = $('#fingpt-textarea');
    const sendBtn = $('#fingpt-send-btn');

    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    sendBtn.addEventListener('click', () => handleSend());

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.key === 'k') || (e.altKey && e.key === 'c')) {
        e.preventDefault();
        toggleDoubtBot();
      }
    });
  }

  function toggleDoubtBot(force) {
    createDoubtBotUI();
    const widget = $('#fingpt-widget');
    if (!widget) return;
    isOpen = force !== undefined ? force : !isOpen;
    if (isOpen) {
      widget.classList.add('open');
      setTimeout(() => $('#fingpt-textarea').focus(), 150);
    } else {
      widget.classList.remove('open');
    }
  }

  function toggleMaximize() {
    const widget = $('#fingpt-widget');
    const btn = $('#fingpt-max-btn');
    isMaximized = !isMaximized;
    if (isMaximized) {
      widget.classList.add('maximized');
      btn.title = 'Dock to Corner';
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>`;
    } else {
      widget.classList.remove('maximized');
      btn.title = 'Expand / Maximize Window';
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>`;
    }
  }

  function resetChat() {
    conversationHistory = [];
    const stream = $('#fingpt-messages-stream');
    stream.innerHTML = '';
    renderWelcomeGreeting();
  }

  function renderWelcomeGreeting() {
    const stream = $('#fingpt-messages-stream');
    const org = (window.APP && window.APP.org) || {};

    const greetingHtml = `
      <div class="fingpt-msg-row bot">
        <div class="fingpt-avatar" style="width:30px;height:30px;font-size:13px;flex-shrink:0;">G</div>
        <div class="fingpt-msg-bubble">
          <h3>Hello! Welcome to ConvosisBooks 👋</h3>
          <div style="background:#fff7ed;border:1px solid rgba(234,88,12,0.3);border-radius:8px;padding:6px 10px;margin:6px 0 10px;display:flex;align-items:center;justify-content:space-between;font-size:11px;">
            <span style="color:#ea580c;font-weight:700;display:flex;align-items:center;gap:6px;">
              <span style="width:7px;height:7px;border-radius:50%;background:#ea580c;display:inline-block;box-shadow:0 0 6px #ea580c;"></span>
              Live Ledger Database Connected
            </span>
            <span style="color:#000000;font-weight:600;">Accrual Accounting Grounding</span>
          </div>
          <p style="margin:4px 0 10px;line-height:1.5;color:#000000;">I'm your accounting assistant for <b>${esc(org.name || 'your business')}</b>. I can help you understand bookkeeping, GST, tax-related questions, bank reconciliation, financial reports, and ledger transactions. Select a topic below to get started.</p>

          <div style="font-size:12px;font-weight:800;color:#ea580c;margin:8px 0 4px;text-transform:uppercase;letter-spacing:0.5px;">
            Suggested Doubts to Explore:
          </div>
          <div class="fingpt-prompts-grid" id="fingpt-suggested-prompts-container">
            ${renderPromptButtons(CATEGORY_PROMPTS[activeCategory] || CATEGORY_PROMPTS.all)}
          </div>
        </div>
      </div>
    `;
    stream.innerHTML = greetingHtml;
    stream.scrollTop = stream.scrollHeight;
  }

  function renderPromptButtons(prompts) {
    return prompts.map(p => `
      <button class="fingpt-prompt-btn" data-query="${esc(p)}" type="button">
        <span>${esc(p)}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    `).join('');
  }

  function renderCategoryPrompts(cat) {
    const container = document.getElementById('fingpt-suggested-prompts-container');
    if (!container) return;
    const prompts = CATEGORY_PROMPTS[cat] || CATEGORY_PROMPTS.all;
    container.innerHTML = renderPromptButtons(prompts);
  }

  function parseMarkdown(md) {
    if (!md) return '';
    let out = esc(md);

    // Headers
    out = out.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    out = out.replace(/^#### (.*$)/gim, '<h4>$1</h4>');

    // Bold & Italics
    out = out.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    out = out.replace(/\*(.*?)\*/g, '<i>$1</i>');

    // Code blocks & Inline code
    out = out.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Math block / formulas
    out = out.replace(/\$\$(.*?)\$\$/g, '<div class="fingpt-formula-box">$1</div>');

    // Markdown tables
    const tableRegex = /\|(.+)\|[\r\n]+\|[-:| ]+\|[\r\n]+((?:\|.+|[\r\n]*)+)/g;
    out = out.replace(tableRegex, (match, header, rows) => {
      const ths = header.split('|').map(c => c.trim()).filter(Boolean).map(c => `<th>${c}</th>`).join('');
      const trs = rows.trim().split('\n').map(row => {
        const tds = row.split('|').map(c => c.trim()).filter(Boolean).map(c => `<td>${c}</td>`).join('');
        return `<tr>${tds}</tr>`;
      }).join('');
      return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    });

    // Unordered lists
    out = out.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
    out = out.replace(/(<li>[\s\S]*<\/li>)/, '<ul>$1</ul>');

    // Numbered lists
    out = out.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');

    // Line breaks
    out = out.replace(/\n\n/g, '<br><br>');

    return out;
  }

  async function handleSend(customQuery) {
    if (isTyping) return;
    const textarea = $('#fingpt-textarea');
    const q = (customQuery || textarea.value).trim();
    if (!q) return;

    textarea.value = '';
    textarea.style.height = 'auto';

    const stream = $('#fingpt-messages-stream');

    // Render User Message (Turn white font to orange)
    const userRow = document.createElement('div');
    userRow.className = 'fingpt-msg-row user';
    userRow.innerHTML = `<div class="fingpt-msg-bubble">${esc(q)}</div>`;
    stream.appendChild(userRow);
    stream.scrollTop = stream.scrollHeight;

    // Render Bot Thinking indicator
    const botRow = document.createElement('div');
    botRow.className = 'fingpt-msg-row bot';
    botRow.innerHTML = `
      <div class="fingpt-avatar" style="width:30px;height:30px;font-size:13px;flex-shrink:0;">G</div>
      <div class="fingpt-msg-bubble" style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:12px;color:#ea580c;font-weight:700;">FinGPT is analyzing accounting standards & your ledger…</span>
        <div class="fingpt-typing-dots"><span></span><span></span><span></span></div>
      </div>
    `;
    stream.appendChild(botRow);
    stream.scrollTop = stream.scrollHeight;

    isTyping = true;
    $('#fingpt-send-btn').disabled = true;

    try {
      const payload = {
        query: q,
        category: activeCategory,
        history: conversationHistory.slice(-6)
      };

      const res = await api('ai/doubt-clearance/', { method: 'POST', body: payload });

      // Save history
      conversationHistory.push({ role: 'user', content: q });
      conversationHistory.push({ role: 'assistant', content: res.summary || res.answer });

      let extraContentHtml = '';

      // Cards if any
      if (res.cards && res.cards.length) {
        extraContentHtml += `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:10px 0;">
            ${res.cards.map(c => `
              <div style="background:#fff7ed;border:1px solid rgba(234,88,12,0.3);padding:8px 10px;border-radius:8px;">
                <div style="font-size:11px;color:#000000;font-weight:600;">${esc(c.label)}</div>
                <div style="font-size:15px;font-weight:800;color:#ea580c;margin-top:2px;">${esc(c.value)}</div>
              </div>
            `).join('')}
          </div>
        `;
      }

      // Table Data if any
      if (res.data && res.data.length) {
        const keys = Object.keys(res.data[0]);
        extraContentHtml += `
          <div style="overflow-x:auto;max-height:190px;margin:10px 0;border:1px solid rgba(234,88,12,0.25);border-radius:8px;">
            <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
              <thead>
                <tr style="background:#fff7ed;">
                  ${keys.map(k => `<th style="padding:6px 8px;text-align:left;color:#ea580c;font-weight:700;border-bottom:1px solid rgba(234,88,12,0.25);">${esc(k)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${res.data.map(row => `
                  <tr>
                    ${keys.map(k => `<td style="padding:6px 8px;border-top:1px solid rgba(234,88,12,0.15);color:#000000;">${esc(row[k])}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      // Formula Box if any
      if (res.rule_formula) {
        extraContentHtml += `<div class="fingpt-formula-box"><b style="color:#000000;">Accounting Rule / Formula:</b> <span style="color:#ea580c;">${esc(res.rule_formula)}</span></div>`;
      }

      // Key Takeaways Box
      if (res.key_takeaways && res.key_takeaways.length) {
        extraContentHtml += `
          <div class="fingpt-takeaways">
            <div class="fingpt-takeaways-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Key Takeaways
            </div>
            <ul>
              ${res.key_takeaways.map(t => `<li style="color:#000000;">${esc(t)}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      // Quick Deep-Link Actions
      if (res.quick_actions && res.quick_actions.length) {
        extraContentHtml += `
          <div class="fingpt-actions-row">
            ${res.quick_actions.map(a => `
              <span class="fingpt-action-chip" data-hash="${esc(a.hash)}">
                <span>${esc(a.label)}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </span>
            `).join('')}
          </div>
        `;
      }

      // Follow-up Related Doubts
      if (res.related_doubts && res.related_doubts.length) {
        extraContentHtml += `
          <div style="font-size:11.5px;font-weight:700;color:#ea580c;margin:12px 0 6px;">Related Questions You Can Ask:</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${res.related_doubts.map(rd => `
              <button class="fingpt-prompt-btn" style="padding:4px 8px;font-size:11px;color:#000000;" data-query="${esc(rd)}" type="button">${esc(rd)}</button>
            `).join('')}
          </div>
        `;
      }

      // Toolbar (Copy + Feedback)
      const toolbarHtml = `
        <div class="fingpt-msg-toolbar">
          <button class="fingpt-copy-btn" type="button">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy
          </button>
          <span>·</span>
          <span>Cleared your doubt?</span>
          <button class="fingpt-fb-btn" type="button">👍 Yes</button>
          <button class="fingpt-fb-btn" type="button">👎 More info</button>
        </div>
      `;

      botRow.innerHTML = `
        <div class="fingpt-avatar" style="width:30px;height:30px;font-size:13px;flex-shrink:0;">G</div>
        <div class="fingpt-msg-bubble">
          ${parseMarkdown(res.answer || res.summary)}
          ${extraContentHtml}
          ${toolbarHtml}
        </div>
      `;

    } catch (e) {
      botRow.innerHTML = `
        <div class="fingpt-avatar" style="width:30px;height:30px;font-size:13px;flex-shrink:0;background:#ea580c;color:#000000;">!</div>
        <div class="fingpt-msg-bubble" style="color:#ea580c;border:1.5px solid #ea580c;background:#fff7ed;">
          <b style="color:#000000;">Error reaching FinGPT service:</b> <span style="color:#ea580c;">${esc(e.message || 'Please check your connection and try again.')}</span>
        </div>
      `;
    } finally {
      isTyping = false;
      $('#fingpt-send-btn').disabled = false;
      stream.scrollTop = stream.scrollHeight;
    }
  }

  // Expose global controller
  window.openFinGptDoubtBot = function (query) {
    toggleDoubtBot(true);
    if (query) {
      setTimeout(() => handleSend(query), 100);
    }
  };

  // Override legacy Zia modal to launch the ChatGPT Doubt Bot
  window.ziaAiAssistantModal = function (query) {
    window.openFinGptDoubtBot(query);
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createDoubtBotUI);
  } else {
    createDoubtBotUI();
  }
})();
