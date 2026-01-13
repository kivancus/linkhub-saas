// AWS Knowledge Hub Frontend JavaScript

let sessionId = null;
let isConnected = false;

// Initialize session on page load
async function initializeSession() {
    try {
        updateStatus('connecting', '🟡 Connecting...');
        
        const response = await fetch('/api/sessions/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                preferences: { 
                    theme: 'light',
                    source: 'web-interface'
                }
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            sessionId = result.data.sessionId;
            isConnected = true;
            updateStatus('connected', '🟢 Connected');
            console.log('Session created:', sessionId);
        } else {
            throw new Error(result.error || 'Failed to create session');
        }
    } catch (error) {
        console.error('Failed to initialize session:', error);
        updateStatus('error', '🔴 Connection Error');
        addMessage('Failed to connect to the server. Please refresh the page.', 'bot');
    }
}

function updateStatus(type, text) {
    const indicator = document.getElementById('statusIndicator');
    if (indicator) {
        indicator.textContent = text;
        indicator.className = `status-indicator ${type}`;
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        askQuestion();
    }
}

async function askQuestion() {
    console.log('askQuestion called');
    
    if (!isConnected || !sessionId) {
        console.log('Not connected, initializing session...');
        addMessage('Please wait while we establish connection...', 'bot');
        await initializeSession();
        if (!isConnected) return;
    }

    const input = document.getElementById('questionInput');
    const question = input.value.trim();
    
    console.log('Question:', question);
    
    if (!question) {
        console.log('No question entered');
        return;
    }
    
    const askButton = document.getElementById('askButton');
    
    // Add user message
    addMessage(question, 'user');
    input.value = '';
    askButton.disabled = true;
    askButton.textContent = 'Thinking...';
    
    // Add loading message
    const loadingId = addMessage('🤔 Analyzing your question and searching AWS documentation...', 'bot', true);
    
    try {
        console.log('Sending request to API...');
        const response = await fetch('/api/answers/complete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question: question,
                sessionId: sessionId
            })
        });
        
        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Response data:', result);
        
        // Remove loading message
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) {
            loadingElement.remove();
        }
        
        if (result.success) {
            const answer = result.data.answer;
            const sources = result.data.sources || [];
            const metadata = result.data.metadata || {};
            
            // Add bot response with metadata
            addMessage(answer, 'bot', false, sources, metadata);
        } else {
            addMessage(`❌ I encountered an error: ${result.error || 'Unknown error'}`, 'bot');
        }
        
    } catch (error) {
        console.error('Request error:', error);
        // Remove loading message
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) {
            loadingElement.remove();
        }
        addMessage('❌ Network error occurred. Please check your connection and try again.', 'bot');
        updateStatus('error', '🔴 Network Error');
    }
    
    askButton.disabled = false;
    askButton.textContent = 'Ask';
    input.focus();
}

function addMessage(content, type, isLoading = false, sources = [], metadata = {}) {
    console.log('Adding message:', { content: content.substring(0, 50), type, isLoading });
    
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) {
        console.error('Chat container not found');
        return;
    }
    
    const messageDiv = document.createElement('div');
    const messageId = 'msg-' + Date.now() + '-' + Math.random();
    messageDiv.id = messageId;
    messageDiv.className = `message ${type}-message`;
    
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    
    if (isLoading) {
        bubbleDiv.classList.add('loading');
    }
    
    let messageContent = '';
    if (type === 'user') {
        messageContent = `<strong>👤 You:</strong> ${escapeHtml(content)}`;
    } else {
        messageContent = `<strong>🤖 AWS Assistant:</strong> ${formatAnswer(content)}`;
        
        // Add processing time if available
        if (metadata.pipeline && metadata.pipeline.totalProcessingTime) {
            const processingTime = Math.round(metadata.pipeline.totalProcessingTime);
            messageContent += `<div style="margin-top: 10px; font-size: 11px; color: #666; font-style: italic;">⚡ Processed in ${processingTime}ms</div>`;
        }
        
        // Add sources if available
        if (sources && sources.length > 0) {
            messageContent += '<div class="source-links"><strong>📚 Sources:</strong><br>';
            sources.forEach((source, index) => {
                const title = source.title || source.url;
                messageContent += `<a href="${source.url}" target="_blank" rel="noopener">${escapeHtml(title)}</a>`;
                if (index < sources.length - 1) messageContent += '<br>';
            });
            messageContent += '</div>';
        }
    }
    
    bubbleDiv.innerHTML = messageContent;
    messageDiv.appendChild(bubbleDiv);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    return messageId;
}

function formatAnswer(answer) {
    if (!answer) return '';
    
    return escapeHtml(answer)
        .replace(/## (.*)/g, '<h3>$1</h3>')
        .replace(/### (.*)/g, '<h4>$1</h4>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    initializeSession();
    
    const input = document.getElementById('questionInput');
    if (input) {
        input.focus();
        input.addEventListener('keypress', handleKeyPress);
    }
    
    const button = document.getElementById('askButton');
    if (button) {
        button.addEventListener('click', askQuestion);
    }
    
    console.log('Event listeners attached');
});

// Sample questions for demonstration
const sampleQuestions = [
    "How do I create an S3 bucket with versioning?",
    "What causes Lambda timeout errors?",
    "How to set up VPC peering?",
    "What's the difference between EC2 and Lambda?",
    "How to troubleshoot DynamoDB performance issues?"
];

// Add sample question buttons (optional)
function addSampleQuestions() {
    const chatContainer = document.getElementById('chatContainer');
    const samplesDiv = document.createElement('div');
    samplesDiv.innerHTML = `
        <div class="message bot-message">
            <div class="message-bubble">
                <strong>💡 Try these sample questions:</strong><br><br>
                ${sampleQuestions.map(q => `<button onclick="askSampleQuestion('${q}')" style="display: block; margin: 5px 0; padding: 8px 12px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 15px; cursor: pointer; width: 100%; text-align: left;">${q}</button>`).join('')}
            </div>
        </div>
    `;
    chatContainer.appendChild(samplesDiv);
}

function askSampleQuestion(question) {
    const input = document.getElementById('questionInput');
    if (input) {
        input.value = question;
        askQuestion();
    }
}

// Make functions globally available
window.askQuestion = askQuestion;
window.handleKeyPress = handleKeyPress;
window.askSampleQuestion = askSampleQuestion;