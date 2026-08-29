import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  Loader2Icon,
  MessageSquareIcon,
  SendIcon,
  ShieldAlertIcon
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { getInitials, formatRelativeTime } from '../utils/format';
import { getSocket } from '../utils/socket';

function otherParticipant(conversation, userId) {
  return conversation.participants.find((p) => p._id !== userId) || conversation.participants[0];
}

export function Messages() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(null);

  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);

  const [startingFromListing, setStartingFromListing] = useState(false);
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);

  const isVerified = user?.verificationStatus === 'approved';

  // Load conversations.
  useEffect(() => {
    if (!isVerified) {
      setLoadingList(false);
      return;
    }
    let cancelled = false;
    setLoadingList(true);
    api.getMyConversations()
      .then((data) => {
        if (cancelled) return;
        setConversations(data.conversations);
      })
      .catch((err) => {
        if (!cancelled) setListError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => { cancelled = true; };
  }, [isVerified]);

  // ?sellerId=&listingId= entry point.
  useEffect(() => {
    const sellerId = searchParams.get('sellerId');
    if (!isVerified || !sellerId || loadingList) return;

    setStartingFromListing(true);
    const listingId = searchParams.get('listingId') || undefined;

    api.startConversation({ recipientId: sellerId, listingId })
      .then((data) => {
        setConversations((prev) => {
          const exists = prev.some((c) => c._id === data.conversation._id);
          return exists ? prev : [data.conversation, ...prev];
        });
        setActiveId(data.conversation._id);
        setSearchParams({}, { replace: true });
      })
      .catch((err) => setThreadError(err.message))
      .finally(() => setStartingFromListing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified, loadingList, searchParams]);

  const loadMessages = (id, { silent = false } = {}) => {
    if (!silent) {
      setLoadingThread(true);
      setThreadError(null);
    }
    return api.getMessages(id)
      .then((data) => {
        setMessages((prev) => {
          if (!silent) return data.messages;
          const known = new Set(prev.map((m) => m._id));
          const fresh = data.messages.filter((m) => !known.has(m._id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        // Mark as read when the thread is viewed.
        api.markConversationRead(id).catch(() => {});
      })
      .catch((err) => {
        if (!silent) setThreadError(err.message);
      })
      .finally(() => {
        if (!silent) setLoadingThread(false);
      });
  };

  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId);

    // Socket.io real-time: join the conversation room and listen for
    // new messages + typing indicators. Falls back to polling if the
    // socket isn't connected.
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('conversation:join', activeId);
    }

    const handleMessageNew = (payload) => {
      if (payload.conversationId !== activeId) return;
      setMessages((prev) => {
        if (prev.some((m) => m._id === payload.message._id)) return prev;
        return [...prev, payload.message];
      });
      // Mark as read since we have it open.
      api.markConversationRead(activeId).catch(() => {});
    };

    const handleTyping = (payload) => {
      if (payload.conversationId !== activeId) return;
      if (payload.userId === String(user.id)) return;
      setOtherTyping(true);
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = window.setTimeout(() => setOtherTyping(false), 3000);
    };

    socket?.on('message:new', handleMessageNew);
    socket?.on('typing', handleTyping);

    // Polling fallback (every 8s instead of 4s — Socket.io does the
    // heavy lifting when connected).
    const interval = window.setInterval(() => loadMessages(activeId, { silent: true }), 8000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(typingTimerRef.current);
      socket?.off('message:new', handleMessageNew);
      socket?.off('typing', handleTyping);
      socket?.emit('conversation:leave', activeId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Periodically refresh conversation list.
  useEffect(() => {
    if (!isVerified) return;
    const interval = window.setInterval(() => {
      api.getMyConversations()
        .then((data) => setConversations(data.conversations))
        .catch(() => {});
    }, 15000);
    return () => window.clearInterval(interval);
  }, [isVerified]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  if (!user) return null;

  const activeConversation = conversations.find((c) => c._id === activeId) || null;

  const handleSend = async (event) => {
    event.preventDefault();
    if (!draft.trim() || !activeId) return;

    setSending(true);
    try {
      const data = await api.sendMessage(activeId, draft.trim());
      setMessages((prev) => [...prev, data.message]);
      setDraft('');
      setConversations((prev) =>
        prev
          .map((c) => (c._id === activeId ? { ...c, lastMessageAt: new Date().toISOString() } : c))
          .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (value) => {
    setDraft(value);
    const socket = getSocket();
    if (socket?.connected && activeId) {
      socket.emit('typing', { conversationId: activeId, isTyping: Boolean(value.trim()) });
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-ink-950">
      <Navbar />
      <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-5 py-10 lg:px-8">
        <h1 className="text-3xl font-extrabold tracking-[-0.02em] text-chalk sm:text-4xl">
          Messages
        </h1>

        {!isVerified ? (
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-5">
            <ShieldAlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-tangerine" />
            <div>
              <p className="text-sm font-semibold text-chalk">
                Verify your student ID to message people
              </p>
              <p className="mt-1 text-sm text-chalk-muted">
                Quad only opens messaging up to verified students, to keep
                conversations to real people on campus.
              </p>
              <Link
                to="/verify"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-acid px-4 py-2 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.03]"
              >
                Verify your ID
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid flex-1 grid-cols-1 overflow-hidden rounded-2xl border border-ink-700 md:grid-cols-[300px_1fr]">
            {/* Conversation list */}
            <div className={`border-ink-700 md:border-r ${activeId ? 'hidden md:block' : ''}`}>
              {loadingList || startingFromListing ? (
                <div className="flex h-full items-center justify-center px-6 py-16">
                  <Loader2Icon className="h-5 w-5 animate-spin text-chalk-dim" />
                </div>
              ) : listError ? (
                <div className="px-5 py-6 text-sm text-rose">{listError}</div>
              ) : conversations.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <MessageSquareIcon className="mx-auto h-6 w-6 text-chalk-dim" />
                  <p className="mt-3 text-sm font-semibold text-chalk">No conversations yet</p>
                  <p className="mt-1 text-sm text-chalk-muted">
                    Message a seller from a listing to start one.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-ink-700/70">
                  {conversations.map((c) => {
                    const other = otherParticipant(c, user.id);
                    const active = c._id === activeId;
                    return (
                      <li key={c._id}>
                        <button
                          type="button"
                          onClick={() => setActiveId(c._id)}
                          className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 ease-smooth ${
                            active ? 'bg-ink-850' : 'hover:bg-ink-850/60'
                          }`}
                        >
                          <Avatar initials={getInitials(other?.name)} size="sm" accent="acid" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-chalk">
                              {other?.name || 'Deleted user'}
                            </p>
                            {c.listing?.title && (
                              <p className="truncate text-xs text-chalk-muted">{c.listing.title}</p>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-chalk-dim">
                            {formatRelativeTime(c.lastMessageAt)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Active thread */}
            <div className="flex min-h-[420px] flex-col">
              {!activeConversation ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <MessageSquareIcon className="h-6 w-6 text-chalk-dim" />
                  <p className="text-sm text-chalk-muted">
                    {conversations.length === 0
                      ? 'Nothing to show yet.'
                      : 'Pick a conversation to read it.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 border-b border-ink-700 px-5 py-3.5 md:hidden">
                    <button
                      type="button"
                      onClick={() => setActiveId(null)}
                      aria-label="Back to conversations"
                      className="text-chalk-muted transition-colors hover:text-chalk"
                    >
                      <ArrowLeftIcon className="h-4 w-4" />
                    </button>
                    <p className="text-sm font-semibold text-chalk">
                      {otherParticipant(activeConversation, user.id)?.name}
                    </p>
                  </div>

                  <div className="styled-scroll flex-1 space-y-3 overflow-y-auto px-5 py-5">
                    {loadingThread ? (
                      <div className="flex justify-center py-10">
                        <Loader2Icon className="h-5 w-5 animate-spin text-chalk-dim" />
                      </div>
                    ) : (
                      messages.map((m) => {
                        const mine = m.sender?._id === user.id;
                        return (
                          <div
                            key={m._id}
                            className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-[15px] ${
                                mine ? 'bg-acid text-ink-950' : 'bg-ink-850 text-chalk'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{m.text}</p>
                              <p
                                className={`mt-1 text-[11px] ${
                                  mine ? 'text-ink-950/60' : 'text-chalk-dim'
                                }`}
                              >
                                {formatRelativeTime(m.createdAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {otherTyping && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl bg-ink-850 px-4 py-2.5 text-sm text-chalk-muted">
                          <span className="inline-flex gap-1">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-chalk-dim" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-chalk-dim [animation-delay:200ms]" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-chalk-dim [animation-delay:400ms]" />
                          </span>
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {threadError && (
                    <p className="flex items-center gap-2 px-5 pb-2 text-sm text-rose">
                      <AlertCircleIcon className="h-4 w-4 shrink-0" />
                      {threadError}
                    </p>
                  )}

                  <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-ink-700 p-3">
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => handleTyping(e.target.value)}
                      placeholder="Write a message…"
                      className="flex-1 rounded-full border border-ink-600 bg-ink-850 px-4 py-2.5 text-[15px] text-chalk placeholder:text-chalk-dim focus:border-acid focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      aria-label="Send message"
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-acid text-ink-950 transition-transform hover:scale-[1.05] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sending ? (
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                      ) : (
                        <SendIcon className="h-4 w-4" />
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
