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
    if (document.getElementById('convobot-chat-styles')) return;
    const style = document.createElement('style');
    style.id = 'convobot-chat-styles';
    style.textContent = `

      #convobot-launcher {
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
      #convobot-launcher:hover {
        transform: translateY(-3px) scale(1.03);
        box-shadow: 0 14px 35px -4px rgba(234, 88, 12, 0.5), 0 0 25px rgba(249, 115, 22, 0.35);
        border-color: #ea580c;
      }
      .convobot-launcher-icon {
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
      .convobot-launcher-icon svg {
        stroke: #000000;
      }
      .convobot-launcher-pulse {
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        border: 2px solid #ea580c;
        opacity: 0.8;
        animation: convobot-ping 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;
      }
      @keyframes convobot-ping {
        0% { transform: scale(0.95); opacity: 0.9; }
        70%, 100% { transform: scale(1.4); opacity: 0; }
      }
      .convobot-launcher-text {
        padding-right: 6px;
        display: flex;
        flex-direction: column;
      }
      .convobot-launcher-title {
        font-size: 13.5px;
        font-weight: 800;
        color: #ea580c;
        line-height: 1.2;
        letter-spacing: -0.2px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .convobot-launcher-badge {
        font-size: 9px;
        padding: 1px 6px;
        border-radius: 99px;
        background: #fff7ed;
        border: 1px solid #ea580c;
        color: #ea580c;
        font-weight: 800;
        text-transform: uppercase;
      }
      .convobot-launcher-sub {
        font-size: 11px;
        color: #000000;
        font-weight: 600;
      }

      #convobot-widget {
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
      #convobot-widget.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }
      #convobot-widget.maximized {
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

      .convobot-header {
        padding: 14px 18px;
        border-bottom: 1.5px solid rgba(234, 88, 12, 0.2);
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #fff7ed;
      }
      .convobot-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .convobot-avatar {
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
      .convobot-title-wrap h3 {
        margin: 0;
        font-size: 14.5px;
        font-weight: 800;
        color: #ea580c;
        letter-spacing: -0.2px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .convobot-enterprise-badge {
        font-size: 10px;
        padding: 2px 7px;
        border-radius: 99px;
        background: #ffedd5;
        border: 1px solid rgba(234, 88, 12, 0.4);
        color: #ea580c;
        font-weight: 700;
      }
      .convobot-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        color: #000000;
        font-weight: 600;
      }
      .convobot-status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ea580c;
        box-shadow: 0 0 6px #ea580c;
      }
      .convobot-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .convobot-tool-btn {
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
      .convobot-tool-btn:hover {
        background: #ffedd5;
        color: #ea580c;
      }
      .convobot-tool-btn svg {
        stroke: currentColor;
      }

      .convobot-categories {
        padding: 8px 14px;
        display: flex;
        gap: 6px;
        overflow-x: auto;
        white-space: nowrap;
        border-bottom: 1px solid rgba(234, 88, 12, 0.18);
        background: rgba(255, 255, 255, 0.7);
      }
      .convobot-categories::-webkit-scrollbar { height: 3px; }
      .convobot-categories::-webkit-scrollbar-thumb { background: rgba(234, 88, 12, 0.3); border-radius: 4px; }
      .convobot-cat-btn {
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
      .convobot-cat-btn:hover {
        background: #fff7ed;
        border-color: #ea580c;
        color: #ea580c;
      }
      .convobot-cat-btn.active {
        background: #fff7ed;
        border: 1.5px solid #ea580c;
        color: #ea580c;
        font-weight: 800;
        box-shadow: 0 2px 8px rgba(234, 88, 12, 0.18);
      }

      .convobot-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        scroll-behavior: smooth;
        background: transparent;
      }
      .convobot-messages::-webkit-scrollbar { width: 5px; }
      .convobot-messages::-webkit-scrollbar-thumb { background: rgba(234, 88, 12, 0.3); border-radius: 4px; }

      .convobot-msg-row {
        display: flex;
        gap: 10px;
        width: 100%;
      }
      .convobot-msg-row.user {
        justify-content: flex-end;
      }
      .convobot-msg-bubble {
        max-width: 88%;
        padding: 12px 16px;
        border-radius: 14px;
        font-size: 13.5px;
        line-height: 1.55;
        position: relative;
        word-break: break-word;
      }
      .convobot-msg-row.user .convobot-msg-bubble {
        background: #fff7ed;
        border: 1.5px solid rgba(234, 88, 12, 0.45);
        color: #ea580c;
        font-weight: 600;
        border-bottom-right-radius: 4px;
        box-shadow: 0 2px 10px rgba(234, 88, 12, 0.12);
      }
      .convobot-msg-row.bot .convobot-msg-bubble {
        background: #ffffff;
        border: 1px solid rgba(234, 88, 12, 0.22);
        color: #000000;
        border-bottom-left-radius: 4px;
        box-shadow: 0 3px 14px rgba(0, 0, 0, 0.05);
      }

      .convobot-msg-bubble p {
        margin: 0 0 8px;
        color: #000000;
      }
      .convobot-msg-bubble p:last-child {
        margin-bottom: 0;
      }
      .convobot-msg-bubble h3 {
        font-size: 15px;
        margin: 6px 0 10px;
        font-weight: 800;
        color: #ea580c;
      }
      .convobot-msg-bubble h4 {
        font-size: 13.5px;
        margin: 12px 0 6px;
        font-weight: 700;
        color: #ea580c;
      }
      .convobot-msg-bubble ul, .convobot-msg-bubble ol {
        margin: 6px 0;
        padding-left: 20px;
        color: #000000;
      }
      .convobot-msg-bubble li {
        margin-bottom: 4px;
        color: #000000;
      }
      .convobot-msg-bubble b, .convobot-msg-bubble strong {
        color: #ea580c;
        font-weight: 700;
      }
      .convobot-msg-bubble code {
        background: #fff7ed;
        border: 1px solid rgba(234, 88, 12, 0.3);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: #ea580c;
        font-weight: 600;
      }
      .convobot-msg-bubble pre {
        background: #fff7ed;
        border: 1px solid rgba(234, 88, 12, 0.25);
        border-radius: 8px;
        padding: 10px;
        overflow-x: auto;
      }
      .convobot-msg-bubble pre code {
        background: transparent;
        border: none;
        padding: 0;
        color: #ea580c;
      }
      .convobot-msg-bubble table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
        font-size: 12px;
        border: 1px solid rgba(234, 88, 12, 0.25);
        border-radius: 6px;
        overflow: hidden;
      }
      .convobot-msg-bubble th, .convobot-msg-bubble td {
        border: 1px solid rgba(234, 88, 12, 0.2);
        padding: 6px 8px;
        text-align: left;
      }
      .convobot-msg-bubble th {
        background: #fff7ed;
        font-weight: 700;
        color: #ea580c;
      }
      .convobot-msg-bubble td {
        color: #000000;
      }

      .convobot-takeaways {
        margin-top: 12px;
        padding: 10px 14px;
        background: #fff7ed;
        border: 1.5px solid rgba(234, 88, 12, 0.35);
        border-radius: 8px;
      }
      .convobot-takeaways-title {
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
      .convobot-takeaways-title svg {
        stroke: #ea580c;
      }
      .convobot-takeaways ul {
        margin: 0;
        padding-left: 16px;
        font-size: 12px;
        color: #000000;
      }
      .convobot-takeaways li {
        color: #000000;
      }

      .convobot-formula-box {
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

      .convobot-actions-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 12px;
      }
      .convobot-action-chip {
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
      .convobot-action-chip:hover {
        background: #ffedd5;
        border-color: #ea580c;
        color: #000000;
      }
      .convobot-action-chip svg {
        stroke: currentColor;
      }

      .convobot-msg-toolbar {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px solid rgba(234, 88, 12, 0.18);
        font-size: 11px;
        color: #000000;
      }
      .convobot-copy-btn, .convobot-fb-btn {
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
      .convobot-copy-btn:hover, .convobot-fb-btn:hover {
        color: #ea580c;
      }
      .convobot-copy-btn svg, .convobot-fb-btn svg {
        stroke: currentColor;
      }

      .convobot-typing-dots {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
      }
      .convobot-typing-dots span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ea580c;
        animation: convobot-bounce 1.4s infinite ease-in-out both;
      }
      .convobot-typing-dots span:nth-child(1) { animation-delay: -0.32s; }
      .convobot-typing-dots span:nth-child(2) { animation-delay: -0.16s; }
      @keyframes convobot-bounce {
        0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
        40% { transform: scale(1); opacity: 1; }
      }

      .convobot-prompts-grid {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 10px;
      }
      .convobot-prompt-btn {
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
      .convobot-prompt-btn svg {
        stroke: currentColor;
      }
      .convobot-prompt-btn:hover {
        background: #fff7ed;
        border-color: #ea580c;
        color: #ea580c;
        transform: translateX(3px);
      }

      .convobot-input-area {
        padding: 12px 16px;
        border-top: 1.5px solid rgba(234, 88, 12, 0.2);
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .convobot-input-row {
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }
      #convobot-textarea {
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
      #convobot-textarea::placeholder {
        color: #000000;
        opacity: 0.6;
      }
      #convobot-textarea:focus {
        border-color: #ea580c;
        box-shadow: 0 0 0 2px rgba(234, 88, 12, 0.2);
      }
      #convobot-send-btn {
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
      #convobot-send-btn svg {
        stroke: #000000;
      }
      #convobot-send-btn:hover:not(:disabled) {
        transform: scale(1.05);
        box-shadow: 0 4px 16px rgba(234, 88, 12, 0.55);
      }
      #convobot-send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .convobot-input-hint b {
        color: #ea580c;
      }

      @media (max-width: 640px) {
        #convobot-launcher {
          bottom: 16px;
          right: 16px;
          padding: 4px 8px 4px 4px;
        }
        .convobot-launcher-sub {
          display: none;
        }
        #convobot-widget {
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          max-width: 100vw !important;
          max-height: 100vh !important;
          border-radius: 0 !important;
          border: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createDoubtBotUI() {
    injectStyles();

    if (document.getElementById('convobot-launcher')) return;

    const launcher = document.createElement('div');
    launcher.id = 'convobot-launcher';
    launcher.title = 'Convo Bot · Instant Accounting & Compliance Doubt Clearance (Ctrl+K)';
    launcher.innerHTML = `
      <div class="convobot-launcher-icon">
        <div class="convobot-launcher-pulse"></div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
      </div>
      <div class="convobot-launcher-text">
        <span class="convobot-launcher-title">Convo Bot <span class="convobot-launcher-badge">AI</span></span>
        <span class="convobot-launcher-sub">Get Help with Accounting and Tax</span>
      </div>
    `;
    document.body.appendChild(launcher);

    const widget = document.createElement('div');
    widget.id = 'convobot-widget';
    widget.innerHTML = `

      <div class="convobot-header">
        <div class="convobot-header-left">
          <div class="convobot-avatar">C</div>
          <div class="convobot-title-wrap">
            <h3>Convo Bot <span class="convobot-enterprise-badge">Enterprise</span></h3>
            <div class="convobot-status-pill">
              <span class="convobot-status-dot"></span>
              <span>Accounting Assistant · Online</span>
            </div>
          </div>
        </div>
        <div class="convobot-header-actions">
          <button class="convobot-tool-btn" id="convobot-reset-btn" title="New Chat / Clear Conversation" type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path></svg>
          </button>
          <button class="convobot-tool-btn" id="convobot-max-btn" title="Expand / Maximize Window" type="button">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
          </button>
          <button class="convobot-tool-btn" id="convobot-close-btn" title="Minimize / Close" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <div class="convobot-categories">
        <button class="convobot-cat-btn active" data-cat="all" type="button">⚡ All Doubts</button>
        <button class="convobot-cat-btn" data-cat="accounting" type="button">📖 Accounting & Ledger</button>
        <button class="convobot-cat-btn" data-cat="tax" type="button">🏛️ GST & Regional Tax</button>
        <button class="convobot-cat-btn" data-cat="banking" type="button">🏦 Banking & Gateways</button>
        <button class="convobot-cat-btn" data-cat="security" type="button">🛡️ SOC2, GDPR & Security</button>
        <button class="convobot-cat-btn" data-cat="live" type="button">📊 Live Business Data</button>
      </div>

      <div class="convobot-messages" id="convobot-messages-stream"></div>

      <div class="convobot-input-area">
        <div class="convobot-input-row">
          <textarea id="convobot-textarea" rows="1" placeholder="Ask your accounting or tax doubt..." autocomplete="off"></textarea>
          <button id="convobot-send-btn" type="button" title="Send (Enter)">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
        <div class="convobot-input-hint">
          <span>Press <b>Enter</b> to send, <b>Shift+Enter</b> for new line</span>
          <span>Shortcut: <b>Ctrl+K</b></span>
        </div>
      </div>
    `;
    document.body.appendChild(widget);

    renderWelcomeGreeting();

    launcher.addEventListener('click', () => toggleDoubtBot());
    $('#convobot-close-btn').addEventListener('click', () => toggleDoubtBot(false));
    $('#convobot-max-btn').addEventListener('click', toggleMaximize);
    $('#convobot-reset-btn').addEventListener('click', resetChat);

    widget.addEventListener('click', (e) => {
      const catBtn = e.target.closest('.convobot-cat-btn');
      if (catBtn) {
        $$('.convobot-cat-btn', widget).forEach(b => b.classList.remove('active'));
        catBtn.classList.add('active');
        activeCategory = catBtn.dataset.cat || 'all';
        renderCategoryPrompts(activeCategory);
      }

      const promptBtn = e.target.closest('.convobot-prompt-btn');
      if (promptBtn) {
        const text = promptBtn.dataset.query || promptBtn.textContent.trim();
        handleSend(text);
      }

      const actionLink = e.target.closest('.convobot-action-chip');
      if (actionLink && actionLink.dataset.hash) {
        location.hash = actionLink.dataset.hash;
        if (!isMaximized) toggleDoubtBot(false);
      }

      const copyBtn = e.target.closest('.convobot-copy-btn');
      if (copyBtn) {
        const bubble = copyBtn.closest('.convobot-msg-bubble');
        if (bubble) {
          const clone = bubble.cloneNode(true);
          const toolbar = clone.querySelector('.convobot-msg-toolbar');
          if (toolbar) toolbar.remove();
          navigator.clipboard.writeText(clone.innerText.trim()).then(() => {
            copyBtn.innerHTML = `✓ Copied`;
            setTimeout(() => { copyBtn.innerHTML = `Copy`; }, 2000);
          });
        }
      }

      const fbBtn = e.target.closest('.convobot-fb-btn');
      if (fbBtn) {
        fbBtn.style.color = '#ea580c';
        fbBtn.textContent = '✓ Thanks for feedback!';
      }
    });

    const textarea = $('#convobot-textarea');
    const sendBtn = $('#convobot-send-btn');

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
    const widget = $('#convobot-widget');
    if (!widget) return;
    isOpen = force !== undefined ? force : !isOpen;
    if (isOpen) {
      widget.classList.add('open');
      setTimeout(() => $('#convobot-textarea').focus(), 150);
    } else {
      widget.classList.remove('open');
    }
  }

  function toggleMaximize() {
    const widget = $('#convobot-widget');
    const btn = $('#convobot-max-btn');
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
    const stream = $('#convobot-messages-stream');
    stream.innerHTML = '';
    renderWelcomeGreeting();
  }

  function renderWelcomeGreeting() {
    const stream = $('#convobot-messages-stream');
    const org = (window.APP && window.APP.org) || {};

    const greetingHtml = `
      <div class="convobot-msg-row bot">
        <div class="convobot-avatar" style="width:30px;height:30px;font-size:13px;flex-shrink:0;">C</div>
        <div class="convobot-msg-bubble">
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
          <div class="convobot-prompts-grid" id="convobot-suggested-prompts-container">
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
      <button class="convobot-prompt-btn" data-query="${esc(p)}" type="button">
        <span>${esc(p)}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    `).join('');
  }

  function renderCategoryPrompts(cat) {
    const container = document.getElementById('convobot-suggested-prompts-container');
    if (!container) return;
    const prompts = CATEGORY_PROMPTS[cat] || CATEGORY_PROMPTS.all;
    container.innerHTML = renderPromptButtons(prompts);
  }

  function sanitizeBotHtml(dirty) {
    if (!dirty) return '';
    const allowedTags = new Set([
      'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'B', 'STRONG', 'I', 'EM', 'U',
      'CODE', 'PRE', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY',
      'TR', 'TH', 'TD', 'DIV', 'SPAN', 'BR', 'HR', 'A'
    ]);
    const parser = new DOMParser();
    const doc = parser.parseFromString('<div>' + dirty + '</div>', 'text/html');
    const container = doc.body.firstElementChild || doc.body;

    function cleanNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return;
      if (node.nodeType !== Node.ELEMENT_NODE) {
        node.remove();
        return;
      }
      const tagName = node.tagName.toUpperCase();
      if (!allowedTags.has(tagName)) {
        const text = doc.createTextNode(node.textContent || '');
        node.replaceWith(text);
        return;
      }

      const attrs = Array.from(node.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        const val = attr.value || '';
        if (name.startsWith('on')) {
          node.removeAttribute(name);
        } else if (name === 'href') {
          const valLower = val.trim().toLowerCase();
          if (valLower.startsWith('javascript:') || valLower.startsWith('data:') || valLower.startsWith('vbscript:')) {
            node.removeAttribute('href');
          } else {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
          }
        } else if (name === 'style') {
          const valLower = val.toLowerCase();
          if (valLower.includes('expression') || valLower.includes('behavior') || valLower.includes('javascript:') || valLower.includes('url(')) {
            node.removeAttribute('style');
          }
        } else if (!['class', 'id', 'data-hash', 'data-query', 'title', 'target', 'rel'].includes(name)) {
          node.removeAttribute(name);
        }
      }

      Array.from(node.childNodes).forEach(cleanNode);
    }

    Array.from(container.childNodes).forEach(cleanNode);
    return container.innerHTML;
  }

  function parseMarkdown(md) {
    if (!md) return '';

    const placeholders = [];
    let text = String(md);

    text = text.replace(/```([a-z0-9_-]*)\s*\n?([\s\S]*?)```/gi, function(match, lang, codeContent) {
      const idx = placeholders.length;
      placeholders.push('<pre class="convobot-code-block"><code>' + esc(codeContent.trim()) + '</code></pre>');
      return '@@@CB_BLOCK_' + idx + '@@@';
    });

    text = text.replace(/`([^`\n]+)`/g, function(match, codeContent) {
      const idx = placeholders.length;
      placeholders.push('<code class="convobot-inline-code">' + esc(codeContent) + '</code>');
      return '@@@CB_BLOCK_' + idx + '@@@';
    });

    text = text.replace(/\$\$([\s\S]*?)\$\$/g, function(match, formula) {
      const idx = placeholders.length;
      placeholders.push('<div class="convobot-formula-box">' + esc(formula.trim()) + '</div>');
      return '@@@CB_BLOCK_' + idx + '@@@';
    });

    let out = esc(text);

    out = out.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    out = out.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    out = out.replace(/^## (.*$)/gim, '<h3>$1</h3>');
    out = out.replace(/^# (.*$)/gim, '<h3>$1</h3>');

    out = out.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    out = out.replace(/__(.+?)__/g, '<b>$1</b>');
    out = out.replace(/\*([^\*\n]+)\*/g, '<i>$1</i>');
    out = out.replace(/_([^_\n]+)_/g, '<i>$1</i>');

    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function(match, label, href) {
      const hrefClean = href.trim();
      const hrefLower = hrefClean.toLowerCase();
      if (hrefLower.startsWith('http://') || hrefLower.startsWith('https://') || hrefLower.startsWith('#') || hrefLower.startsWith('mailto:')) {
        return '<a href="' + hrefClean + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
      }
      return label;
    });

    const tableRegex = /\|(.+)\|[\r\n]+\|[-:| ]+\|[\r\n]+((?:\|.+|[\r\n]*)+)/g;
    out = out.replace(tableRegex, function(match, header, rows) {
      const ths = header.split('|').map(c => c.trim()).filter(Boolean).map(c => '<th>' + c + '</th>').join('');
      const trs = rows.trim().split('\n').map(row => {
        const tds = row.split('|').map(c => c.trim()).filter(Boolean).map(c => '<td>' + c + '</td>').join('');
        return '<tr>' + tds + '</tr>';
      }).join('');
      return '<div class="convobot-table-wrap"><table><thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
    });

    const lines = out.split('\n');
    let inUl = false;
    let inOl = false;
    const processedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
      const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);

      if (ulMatch) {
        if (inOl) { processedLines.push('</ol>'); inOl = false; }
        if (!inUl) { processedLines.push('<ul>'); inUl = true; }
        processedLines.push('<li>' + ulMatch[1] + '</li>');
      } else if (olMatch) {
        if (inUl) { processedLines.push('</ul>'); inUl = false; }
        if (!inOl) { processedLines.push('<ol>'); inOl = true; }
        processedLines.push('<li>' + olMatch[2] + '</li>');
      } else {
        if (inUl) { processedLines.push('</ul>'); inUl = false; }
        if (inOl) { processedLines.push('</ol>'); inOl = false; }
        processedLines.push(line);
      }
    }
    if (inUl) processedLines.push('</ul>');
    if (inOl) processedLines.push('</ol>');
    out = processedLines.join('\n');

    out = out.replace(/\n\n+/g, '<br><br>');

    out = out.replace(/@@@CB_BLOCK_(\d+)@@@/g, function(match, idx) {
      return placeholders[Number(idx)] || '';
    });

    return sanitizeBotHtml(out);
  }

  async function handleSend(customQuery) {
    if (isTyping) return;
    const textarea = $('#convobot-textarea');
    const q = (customQuery || textarea.value).trim();
    if (!q) return;

    textarea.value = '';
    textarea.style.height = 'auto';

    const stream = $('#convobot-messages-stream');

    const userRow = document.createElement('div');
    userRow.className = 'convobot-msg-row user';
    userRow.innerHTML = `<div class="convobot-msg-bubble">${esc(q)}</div>`;
    stream.appendChild(userRow);
    stream.scrollTop = stream.scrollHeight;

    const botRow = document.createElement('div');
    botRow.className = 'convobot-msg-row bot';
    botRow.innerHTML = `
      <div class="convobot-avatar" style="width:30px;height:30px;font-size:13px;flex-shrink:0;">C</div>
      <div class="convobot-msg-bubble" style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:12px;color:#ea580c;font-weight:700;">ConvoBot is analyzing accounting standards & your ledger…</span>
        <div class="convobot-typing-dots"><span></span><span></span><span></span></div>
      </div>
    `;
    stream.appendChild(botRow);
    stream.scrollTop = stream.scrollHeight;

    isTyping = true;
    $('#convobot-send-btn').disabled = true;

    try {
      const payload = {
        query: q,
        category: activeCategory,
        history: conversationHistory.slice(-6)
      };

      const res = await api('convobot/doubt-clearance/', { method: 'POST', body: payload });

      conversationHistory.push({ role: 'user', content: q });
      conversationHistory.push({ role: 'assistant', content: res.summary || res.answer });

      let extraContentHtml = '';

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

      if (res.rule_formula) {
        extraContentHtml += `<div class="convobot-formula-box"><b style="color:#000000;">Accounting Rule / Formula:</b> <span style="color:#ea580c;">${esc(res.rule_formula)}</span></div>`;
      }

      if (res.key_takeaways && res.key_takeaways.length) {
        extraContentHtml += `
          <div class="convobot-takeaways">
            <div class="convobot-takeaways-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Key Takeaways
            </div>
            <ul>
              ${res.key_takeaways.map(t => `<li style="color:#000000;">${esc(t)}</li>`).join('')}

            </ul>

          </div>

        `;
      }

      if (res.quick_actions && res.quick_actions.length) {
        extraContentHtml += `
          <div class="convobot-actions-row">
            ${res.quick_actions.map(a => `
              <span class="convobot-action-chip" data-hash="${esc(a.hash)}">
                <span>${esc(a.label)}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </span>
            `).join('')}
          </div>

        `;
      }

      if (res.related_doubts && res.related_doubts.length) {
        extraContentHtml += `
          <div style="font-size:11.5px;font-weight:700;color:#ea580c;margin:12px 0 6px;">Related Questions You Can Ask:</div>

          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${res.related_doubts.map(rd => `
              <button class="convobot-prompt-btn" style="padding:4px 8px;font-size:11px;color:#000000;" data-query="${esc(rd)}" type="button">${esc(rd)}</button>
            `).join('')}
          </div>

        `;
      }

      const toolbarHtml = `
        <div class="convobot-msg-toolbar">
          <button class="convobot-copy-btn" type="button">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>

            Copy
          </button>

          <span>·</span>

          <span>Cleared your doubt?</span>

          <button class="convobot-fb-btn" type="button">👍 Yes</button>

          <button class="convobot-fb-btn" type="button">👎 More info</button>

        </div>

      `;

      botRow.innerHTML = `
        <div class="convobot-avatar" style="width:30px;height:30px;font-size:13px;flex-shrink:0;">C</div>

        <div class="convobot-msg-bubble">
          ${parseMarkdown(res.answer || res.summary)}
          ${extraContentHtml}
          ${toolbarHtml}
        </div>

      `;

    } catch (e) {
      botRow.innerHTML = `
        <div class="convobot-avatar" style="width:30px;height:30px;font-size:13px;flex-shrink:0;background:#ea580c;color:#000000;">!</div>

        <div class="convobot-msg-bubble" style="color:#ea580c;border:1.5px solid #ea580c;background:#fff7ed;">
          <b style="color:#000000;">Error reaching ConvoBot service:</b> <span style="color:#ea580c;">${esc(e.message || 'Please check your connection and try again.')}</span>
        </div>

      `;
    } finally {
      isTyping = false;
      $('#convobot-send-btn').disabled = false;
      stream.scrollTop = stream.scrollHeight;
    }
  }

  window.openConvoBot = function (query) {
    toggleDoubtBot(true);
    if (query) {
      setTimeout(() => handleSend(query), 100);
    }
  };

  window.convobotAiAssistantModal = function (query) {
    window.openConvoBot(query);
  };

  window.openFinGptDoubtBot = window.openConvoBot;
  window.ziaAiAssistantModal = window.convobotAiAssistantModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createDoubtBotUI);
  } else {
    createDoubtBotUI();
  }
})();