import React, { useState, useRef, useEffect } from 'react';
import { Hash, Send, Smile, Paperclip, FileText, Download, X } from 'lucide-react';
import type { Channel, Message, User, MessageAttachment } from '../types';

interface ChatAreaProps {
  channel: Channel;
  currentUser: User | null;
  messages: Message[];
  onSendMessage: (text: string, attachment?: MessageAttachment) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  channel,
  currentUser,
  messages,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<MessageAttachment | null>(null);
  const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const channelMessages = messages.filter((m) => m.channelId === channel.id);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [channelMessages]);

  // Handle Ctrl+V paste of screenshots
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const processFile = (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      alert('O arquivo deve ter no máximo 8MB.');
      return;
    }

    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPendingAttachment({
          name: file.name || 'imagem.png',
          type: isImage ? 'image' : 'file',
          url: reader.result,
          size: file.size,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !pendingAttachment) return;
    onSendMessage(inputText.trim(), pendingAttachment || undefined);
    setInputText('');
    setPendingAttachment(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex-1 bg-[#14151f] flex flex-col justify-between overflow-hidden relative">
      {/* Channel Header */}
      <div className="h-12 px-6 border-b border-[#212330] flex items-center justify-between bg-[#161722] shadow-sm z-10">
        <div className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-slate-400" />
          <span className="font-bold text-slate-200">{channel.name}</span>
          <div className="w-[1px] h-4 bg-[#2a2c3d] mx-2" />
          <span className="text-xs text-slate-400">Canal de bate-papo em tempo real</span>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4">
        {channelMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
            <div className="w-16 h-16 rounded-full bg-[#1b1c28] flex items-center justify-center text-slate-400">
              <Hash className="w-8 h-8" />
            </div>
            <div className="text-lg font-bold text-slate-300">Bem-vindo a #{channel.name}!</div>
            <div className="text-sm">Esse é o início do canal #{channel.name}. Mande uma mensagem!</div>
          </div>
        ) : (
          channelMessages.map((msg) => {
            const isMe = msg.userId === currentUser?.id;

            return (
              <div key={msg.id} className="flex items-start gap-3 group hover:bg-[#181926]/40 -mx-4 px-4 py-1.5 rounded-lg transition">
                {msg.avatarUrl ? (
                  <img
                    src={msg.avatarUrl}
                    alt={msg.userName}
                    className="w-10 h-10 rounded-full object-cover shrink-0 shadow-md"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-md"
                    style={{ backgroundColor: msg.avatarColor || '#6366f1' }}
                  >
                    {msg.userName.slice(0, 1).toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm font-semibold truncate ${isMe ? 'text-indigo-400' : 'text-slate-200'}`}>
                      {msg.userName}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">{msg.timestamp}</span>
                  </div>

                  {/* Text */}
                  {msg.text && (
                    <div className="text-slate-300 text-sm mt-0.5 break-words select-text">
                      {msg.text}
                    </div>
                  )}

                  {/* Attachment */}
                  {msg.attachment && (
                    <div className="mt-2">
                      {msg.attachment.type === 'image' ? (
                        <img
                          src={msg.attachment.url}
                          alt={msg.attachment.name}
                          onClick={() => setSelectedImageModal(msg.attachment!.url)}
                          className="max-h-72 max-w-sm rounded-xl object-contain border border-[#27293d] cursor-pointer hover:opacity-95 transition shadow-lg"
                        />
                      ) : (
                        <div className="flex items-center gap-3 bg-[#1b1c28] border border-[#27293b] rounded-xl p-3 max-w-sm shadow-md">
                          <div className="w-10 h-10 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-200 truncate">
                              {msg.attachment.name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {formatFileSize(msg.attachment.size)}
                            </div>
                          </div>
                          <a
                            href={msg.attachment.url}
                            download={msg.attachment.name}
                            className="p-2 bg-[#27293a] hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg transition"
                            title="Baixar arquivo"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="px-6 pb-6 pt-2">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Attachment preview banner */}
        {pendingAttachment && (
          <div className="mb-2 bg-[#1b1c28] border border-indigo-500/40 rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-lg max-w-md">
            <div className="flex items-center gap-2.5 truncate">
              {pendingAttachment.type === 'image' ? (
                <img
                  src={pendingAttachment.url}
                  alt="Prévia"
                  className="w-10 h-10 rounded-lg object-cover border border-white/10"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
              )}
              <div className="truncate">
                <div className="text-xs font-bold text-slate-200 truncate">{pendingAttachment.name}</div>
                <div className="text-[10px] text-slate-400">{formatFileSize(pendingAttachment.size)}</div>
              </div>
            </div>
            <button
              onClick={() => setPendingAttachment(null)}
              className="p-1 text-slate-400 hover:text-rose-400 rounded-lg transition"
              title="Cancelar anexo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-[#1b1c28] border border-[#27293b] rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-lg focus-within:border-indigo-500 transition-colors"
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-slate-400 hover:text-indigo-400 transition cursor-pointer"
            title="Anexar arquivo ou imagem"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Conversar em #${channel.name}... (cole fotos com Ctrl+V)`}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-400 outline-none select-text"
          />

          <button
            type="button"
            className="text-slate-400 hover:text-amber-400 transition"
            title="Emojis"
          >
            <Smile className="w-5 h-5" />
          </button>

          <button
            type="submit"
            disabled={!inputText.trim() && !pendingAttachment}
            className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-lg transition shadow-md cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Lightbox Image Preview Modal */}
      {selectedImageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedImageModal(null)}
        >
          <img
            src={selectedImageModal}
            alt="Imagem ampliada"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
