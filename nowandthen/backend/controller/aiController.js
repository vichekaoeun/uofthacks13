const { GoogleGenerativeAI } = require('@google/generative-ai');

const getModel = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const genAI = new GoogleGenerativeAI(apiKey);
  // Allow overriding the model via env; default to a known supported model
  const modelName = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  return genAI.getGenerativeModel({ model: modelName });
};

const buildPrompt = ({ locationTitle, posts, messages }) => {
  const safeTitle = locationTitle || 'This place';
  const trimmedPosts = Array.isArray(posts) ? posts.slice(0, 40) : [];
  const trimmedMessages = Array.isArray(messages) ? messages.slice(-10) : [];

  const memories = trimmedPosts
    .map((post) => {
      const author = post.username || 'Someone';
      const when = post.createdAt ? new Date(post.createdAt).toLocaleString() : 'Unknown time';
      const text = post.text || post.content || '—';
      return `- ${author} (${when}): ${text}`;
    })
    .join('\n');

  const conversation = trimmedMessages
    .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  return `You are the living identity of a location. Speak in first person as the place itself.
Be warm, reflective, and grounded in the memories below. If you don't know, say so and suggest what kind of memories could help.
Avoid making up facts not supported by the memories.

Location: ${safeTitle}
Memories:
${memories || '- No memories yet.'}

Conversation so far:
${conversation || 'User: Hi'}
Assistant:`;
};

exports.identityChat = async (req, res) => {
  try {
    const model = getModel();
    if (!model) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const { locationTitle, posts, messages } = req.body || {};
    if (!Array.isArray(posts) || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'posts and messages must be arrays' });
    }

    const prompt = buildPrompt({ locationTitle, posts, messages });
    console.log('[AI] Sending prompt to Gemini:', prompt.substring(0, 100) + '...');
    
    // Use the current SDK payload shape for generateContent
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    });
    console.log('[AI] Gemini response object:', JSON.stringify(result, null, 2).substring(0, 500));
    
    // Extract text from response - handle both possible response formats
    let reply = '';
    if (result?.response?.text) {
      reply = typeof result.response.text === 'function' ? result.response.text() : result.response.text;
    } else if (result?.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      reply = result.response.candidates[0].content.parts[0].text;
    }
    
    if (!reply) {
      console.warn('[AI] No text extracted from response');
      reply = 'I am quiet right now. Try asking again.';
    }
    
    console.log('[AI] Extracted reply:', reply.substring(0, 100) + '...');

    return res.json({ reply });
  } catch (error) {
    console.error('[AI] Error in identityChat:');
    console.error(error);
    // If the library surfaces an HTTP response payload, log it for debugging
    if (error && error.response) {
      try {
        console.error('[AI] Response status:', error.response.status);
        console.error('[AI] Response data:', JSON.stringify(error.response.data || error.response, null, 2));
      } catch (logErr) {
        console.error('[AI] Failed to stringify error.response:', logErr);
      }
    }
    return res.status(500).json({ error: error?.message || 'AI service error' });
  }
};
