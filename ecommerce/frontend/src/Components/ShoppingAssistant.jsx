
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { getImageUrl } from '../utils/imageUrl'
import './ShoppingAssistant.css'

function isGreeting(message) {
  return /^(?:hi|hello|hey|howdy|good morning|good afternoon|good evening)(?: there)?[!.?,\s]*$/i.test(message)
}

function isThankYou(message) {
  return /^(?:okay[, ]*)?(?:thank you(?: so much| very much)?|thanks(?: a lot| so much)?|appreciate it)[!.?,\s]*$/i.test(message)
}

function getStoredMessages(storageKey) {
  try {
    const savedMessages = sessionStorage.getItem(storageKey)
    const parsedMessages = savedMessages ? JSON.parse(savedMessages) : []
    return Array.isArray(parsedMessages) ? parsedMessages : []
  } catch (error) {
    console.error('Failed to restore shopping assistant chat:', error)
    return []
  }
}

function getSpecificationList(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string')
  if (typeof value !== 'string' || !value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function ShoppingAssistant({ currentUser }) {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const storageKey = `aroShoppingAssistantChat:${currentUser?.id || 'guest'}`
  const [chat, setChat] = useState(() => ({
    owner: storageKey,
    messages: getStoredMessages(storageKey),
    conversationId: null,
  }))
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const navigate = useNavigate()
  const messages = chat.owner === storageKey ? chat.messages : []
  const conversationId = chat.owner === storageKey ? chat.conversationId : null
  const isAuthenticated = Boolean(currentUser?.id)

  useEffect(() => {
    setChat({
      owner: storageKey,
      messages: isAuthenticated ? [] : getStoredMessages(storageKey),
      conversationId: null,
    })
    setShowHistory(false)
    setHistoryError('')

    if (!isAuthenticated) {
      setHistory([])
      return undefined
    }

    let cancelled = false
    setHistoryLoading(true)
    api.aiChats.list()
      .then((conversations) => {
        if (!cancelled) setHistory(conversations)
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load shopping assistant history:', error)
          setHistoryError(error.message || 'Could not load chat history.')
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [storageKey, isAuthenticated])

  useEffect(() => {
    if (chat.owner !== storageKey || isAuthenticated) return

    try {
      if (chat.messages.length) {
        sessionStorage.setItem(storageKey, JSON.stringify(chat.messages))
      } else {
        sessionStorage.removeItem(storageKey)
      }
    } catch (error) {
      console.error('Failed to save shopping assistant chat:', error)
    }
  }, [chat, storageKey, isAuthenticated])

  function closeAssistant() {
    if (!isAuthenticated) {
      setChat({ owner: storageKey, messages: [], conversationId: null })
    }
    setMessage('')
    setIsOpen(false)
    setShowHistory(false)
  }

  function startNewChat() {
    setChat({ owner: storageKey, messages: [], conversationId: null })
    setMessage('')
    setShowHistory(false)
    setHistoryError('')
  }

  async function openSavedChat(savedChat) {
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const savedMessages = await api.aiChats.messages(savedChat.id)
      setChat({
        owner: storageKey,
        conversationId: savedChat.id,
        messages: savedMessages.map((item) => ({
          id: String(item.id),
          userMessage: item.userMessage,
          reply: item.assistantReply || '',
          recommendations: Array.isArray(item.recommendations) ? item.recommendations : [],
          categoryOptions: Array.isArray(item.categoryOptions) ? item.categoryOptions : [],
          notice: item.notice || '',
          error: '',
          pending: false,
        })),
      })
      setShowHistory(false)
    } catch (error) {
      console.error('Failed to open shopping assistant conversation:', error)
      setHistoryError(error.message || 'Could not open this conversation.')
    } finally {
      setHistoryLoading(false)
    }
  }

  async function deleteSavedChat(event, savedChat) {
    event.stopPropagation()
    if (!window.confirm('Delete this chat history? This cannot be undone.')) return

    try {
      await api.aiChats.remove(savedChat.id)
      setHistory((current) => current.filter((item) => item.id !== savedChat.id))
      if (String(conversationId) === String(savedChat.id)) startNewChat()
    } catch (error) {
      console.error('Failed to delete shopping assistant conversation:', error)
      setHistoryError(error.message || 'Could not delete this conversation.')
    }
  }

  async function handleSubmit(event, selectedMessage) {
    event?.preventDefault()

    const userMessage = (selectedMessage ?? message).trim()
    if (!userMessage || loading) return
    const activeConversationId = conversationId

    const context = messages.slice(-6).flatMap((item) => {
      const productSummary = item.recommendations
        .slice(0, 5)
        .map((product) => `${product.name} (${product.category}, ₹${Number(product.price).toLocaleString('en-IN')})`)
        .join('; ')
      const assistantContent = [item.reply, item.notice, productSummary]
        .filter(Boolean)
        .join(' ')

      return [
        { role: 'user', content: item.userMessage },
        ...(assistantContent ? [{ role: 'assistant', content: assistantContent }] : []),
      ]
    }).slice(-10)

    setMessage('')
    const messageId = `${Date.now()}-${Math.random()}`
    const greeting = isGreeting(userMessage)
    const conversationalReply = greeting
      ? 'Hi! 👋 Welcome to Aro.D.Buy. What product are you looking for today? You can tell me a category, budget, or rating.'
      : isThankYou(userMessage)
        ? "You're welcome! Let me know if you'd like help finding another product."
        : ''
    setChat((current) => current.owner === storageKey
      ? {
          ...current,
          messages: [
            ...current.messages,
            {
              id: messageId,
              userMessage,
              recommendations: [],
              categoryOptions: [],
              reply: conversationalReply,
              notice: '',
              error: '',
              pending: !conversationalReply,
            },
          ],
        }
      : current)

    if (conversationalReply) {
      if (isAuthenticated) {
        try {
          const turn = {
            userMessage,
            assistantReply: conversationalReply,
            recommendations: [],
            categoryOptions: [],
            notice: '',
          }
          const savedChat = activeConversationId
            ? await api.aiChats.addMessage(activeConversationId, turn).then(() => null)
            : await api.aiChats.create(turn)
          if (savedChat) {
            setChat((current) => current.owner === storageKey
              ? { ...current, conversationId: savedChat.id }
              : current)
          }
        } catch (error) {
          console.error('Failed to save greeting to chat history:', error)
          setChat((current) => current.owner === storageKey
            ? {
                ...current,
                messages: current.messages.map((item) => item.id === messageId
                  ? { ...item, notice: `Chat history could not be saved: ${error.message}` }
                  : item),
              }
            : current)
        }
        try {
          setHistory(await api.aiChats.list())
        } catch (error) {
          console.error('Failed to refresh shopping assistant history:', error)
          setHistoryError(error.message || 'Could not refresh chat history.')
        }
      }
      return
    }

    setLoading(true)

    try {
      const result = await api.recommendations.get(userMessage, context)
      const recommendations = result.recommendations || []
      let savedChatId = activeConversationId
      let saveError = ''
      if (isAuthenticated) {
        try {
          const turn = {
            userMessage,
            assistantReply: result.message || '',
            recommendations,
            categoryOptions: result.categoryOptions || [],
            notice: result.notice || '',
          }
          if (activeConversationId) {
            await api.aiChats.addMessage(activeConversationId, turn)
          } else {
            const savedChat = await api.aiChats.create(turn)
            savedChatId = savedChat.id
          }
        } catch (error) {
          console.error('Failed to save shopping assistant turn:', error)
          saveError = `Chat history could not be saved: ${error.message}`
        }
        if (!saveError) {
          try {
            setHistory(await api.aiChats.list())
          } catch (error) {
            console.error('Failed to refresh shopping assistant history:', error)
            setHistoryError(error.message || 'Could not refresh chat history.')
          }
        }
      }
      setChat((current) => current.owner === storageKey
        ? {
            ...current,
            conversationId: savedChatId,
            messages: current.messages.map((item) => item.id === messageId
              ? {
                  ...item,
                  recommendations,
                  categoryOptions: result.categoryOptions || [],
                  reply: result.message || '',
                  notice: [result.notice, saveError].filter(Boolean).join(' '),
                  error: !recommendations.length && !result.message
                    ? 'No matching products found. Try changing your budget or search terms.'
                    : '',
                  pending: false,
                }
              : item),
          }
        : current)
    } catch (err) {
      setChat((current) => current.owner === storageKey
        ? {
            ...current,
            messages: current.messages.map((item) => item.id === messageId
              ? {
                  ...item,
                  error: err.message || 'Sorry, something went wrong. Please try again.',
                  pending: false,
                }
              : item),
          }
        : current)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="shopping-assistant">
      {isOpen && (
        <section className="shopping-chat" aria-label="AI shopping assistant">
          <div className="shopping-chat-header">
            <div>
              <h2>Shopping Assistant</h2>
              <p>Tell me what you are looking for</p>
            </div>

            {isAuthenticated && (
              <div className="shopping-chat-header-actions">
                <button
                  type="button"
                  className="shopping-chat-history-toggle"
                  onClick={() => {
                    setShowHistory((current) => !current)
                    setHistoryError('')
                  }}
                  aria-expanded={showHistory}
                >
                  History
                </button>
                <button
                  type="button"
                  className="shopping-chat-history-toggle"
                  onClick={startNewChat}
                >
                  New
                </button>
              </div>
            )}

            <button
              type="button"
              className="shopping-chat-close"
              onClick={closeAssistant}
              aria-label="Close shopping assistant"
            >
              ×
            </button>
          </div>

          <div className="shopping-chat-body" aria-live="polite">
            {showHistory ? (
              <div className="shopping-chat-history">
                <h3>Saved conversations</h3>
                {historyLoading && <p className="shopping-chat-status">Loading chat history...</p>}
                {historyError && <p className="shopping-chat-error" role="alert">{historyError}</p>}
                {!historyLoading && !history.length && (
                  <p className="shopping-chat-history-empty">No saved conversations yet.</p>
                )}
                {history.map((savedChat) => (
                  <div className="shopping-chat-history-item" key={savedChat.id}>
                    <button
                      type="button"
                      className="shopping-chat-history-open"
                      onClick={() => openSavedChat(savedChat)}
                      disabled={historyLoading}
                    >
                      <strong>{savedChat.title}</strong>
                      <span>{new Date(savedChat.updatedAt).toLocaleString()}</span>
                    </button>
                    <button
                      type="button"
                      className="shopping-chat-history-delete"
                      onClick={(event) => deleteSavedChat(event, savedChat)}
                      aria-label={`Delete chat: ${savedChat.title}`}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            ) : !messages.length ? (
              <div className="shopping-chat-welcome">
                <p>Hi! 👋 I can help you find the right product.</p>
                <p className="shopping-chat-example">
                  Try: “Wireless headphones under ₹2,000 with at least 4 stars”
                </p>
              </div>
            ) : null}

            {!showHistory && messages.map((item) => (
              <div className="shopping-chat-message" key={item.id}>
                <p className="shopping-chat-user-message">{item.userMessage}</p>

                {item.pending && (
                  <p className="shopping-chat-status">Finding products for you...</p>
                )}

                {item.reply && (
                  <p className="shopping-chat-reply" role="status">{item.reply}</p>
                )}

                {item.error && (
                  <p className="shopping-chat-error" role="alert">{item.error}</p>
                )}

                {item.notice && (
                  <p className="shopping-chat-status" role="status">{item.notice}</p>
                )}

                {item.categoryOptions?.length > 0 && (
                  <div className="shopping-chat-category-options" aria-label="Available categories and product types">
                    {item.categoryOptions.map((category) => (
                      <button
                        type="button"
                        className="shopping-chat-category-option"
                        key={category}
                        onClick={() => handleSubmit(null, category)}
                        disabled={loading}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}

                {item.recommendations.map((product) => (
                  <article className="shopping-product" key={product.id}>
                    <button
                      type="button"
                      className="shopping-product-link"
                      onClick={() => {
                        closeAssistant()
                        navigate(`/product/${product.id}`)
                      }}
                    >
                      <img
                        src={getImageUrl(product.image)}
                        alt={product.name}
                        className="shopping-product-image"
                      />

                      <span className="shopping-product-info">
                        <strong>{product.name}</strong>
                        <span className="shopping-product-category">
                          {product.category}
                        </span>
                        <span className="shopping-product-price">
                          ₹{Number(product.price).toLocaleString('en-IN')}
                        </span>
                        {Number(product.rating) > 0 && (
                          <span className="shopping-product-rating">
                            ★ {Number(product.rating).toFixed(1)}
                            {product.reviews != null && ` (${product.reviews} reviews)`}
                          </span>
                        )}
                        {getSpecificationList(product.specifications).slice(0, 3).map((specification) => (
                          <span className="shopping-product-specification" key={specification}>
                            {specification}
                          </span>
                        ))}
                      </span>
                    </button>
                  </article>
                ))}
              </div>
            ))}
          </div>

          <form className="shopping-chat-form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What are you looking for?"
              maxLength={500}
              aria-label="Describe the product you want"
              disabled={loading}
            />

            <button type="submit" disabled={loading || !message.trim()}>
              {loading ? '...' : 'Send'}
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="shopping-assistant-toggle"
        onClick={() => isOpen ? closeAssistant() : setIsOpen(true)}
        aria-label={isOpen ? 'Close shopping assistant' : 'Open shopping assistant'}
        aria-expanded={isOpen}
      >
        {isOpen ? '×' : '✦ Ask AI'}
      </button>
    </div>
  )
}

export default ShoppingAssistant
