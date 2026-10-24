import { useEffect, useRef, useState } from 'react';
import type { FormEvent, PointerEvent } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AccountUser } from '../types';

type Video = { videoId: string; title: string; channelTitle: string; description: string; thumbnail: string; source: string };
type ChatMessage = { id: string | number; user_id: string; username: string; content: string; created_at: string; room_id?: string };
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseKey && !supabaseUrl.includes('YOUR_PROJECT') && !supabaseKey.includes('YOUR_SUPABASE')) supabase = createClient(supabaseUrl, supabaseKey);

export function YouTubePage() {
  const [query, setQuery] = useState(''); const [items, setItems] = useState<Video[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [source, setSource] = useState(''); const [selected, setSelected] = useState<Video | null>(null);
  async function search(e?: FormEvent) { e?.preventDefault(); if (!query.trim()) return; setBusy(true); setError(''); setSelected(null); try { const r = await fetch(`/api/youtube/search?q=${encodeURIComponent(query.trim())}&limit=18`); const d = await r.json(); if (!r.ok) throw new Error(d.message || '検索に失敗しました'); setItems(d.items || []); setSource(d.source || ''); } catch (e) { setError(e instanceof Error ? e.message : '検索できませんでした'); setItems([]); } finally { setBusy(false); } }
  return <section className="feature-page"><div className="feature-heading"><div><p className="eyebrow">動画を探す</p><h1><i className="fa-brands fa-youtube"/> YouTube</h1></div></div>
    <form className="search-bar" onSubmit={search}><i className="fa-solid fa-magnifying-glass"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="動画を検索" aria-label="動画を検索"/><button className="primary-button" disabled={busy}>{busy?'検索中…':'検索'}</button></form>
    {error && <div className="notice error">{error}</div>}{source && <p className="source-note">検索元: {source === 'youtube' ? 'YouTube Data API' : 'Invidious'}</p>}
    {selected && <div className="video-player"><button className="close-button player-close" onClick={()=>setSelected(null)} aria-label="閉じる">×</button><iframe title={selected.title} src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(selected.videoId)}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/><h2>{selected.title}</h2><p>{selected.channelTitle}</p></div>}
    <div className="video-grid">{items.map(v=><button className="video-card" key={v.videoId} onClick={()=>setSelected(v)}><div className="video-thumb">{v.thumbnail?<img src={v.thumbnail} alt="" loading="lazy"/>:<div className="thumb-placeholder"><i className="fa-brands fa-youtube"/></div>}<span><i className="fa-solid fa-play"/></span></div><div className="video-meta"><b>{v.title}</b><small>{v.channelTitle}</small></div></button>)}</div>
    {!items.length&&!busy&&!error&&<div className="empty-state"><i className="fa-brands fa-youtube"/><b>見たい動画を検索</b><span>検索結果を選ぶとこの画面で再生できます。</span></div>}
  </section>;
}

export function ChatPage({ user }: { user: AccountUser | null }) {
  const userId = String(user?.id ?? user?.user_id ?? user?.userId ?? user?.userID ?? user?.sub ?? '');
  const username = String(user?.username ?? user?.name ?? 'ユーザー');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('読み込み中…');
  const [chatType, setChatType] = useState<'general' | 'group' | 'direct'>('general');
  const [roomName, setRoomName] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const roomId = chatType === 'general' ? 'general'
    : chatType === 'group' ? `group:${roomName.trim().toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠_-]/g, '-').slice(0, 60) || 'new-group'}`
    : `dm:${[userId, targetUserId.trim()].sort().join(':')}`;

  useEffect(() => {
    if (!supabase) { setStatus('チャットの接続設定がありません。.env の Supabase 設定を確認してください。'); return; }
    if (chatType === 'direct' && !targetUserId.trim()) { setMessages([]); setStatus('相手のユーザーIDを入力してください'); return; }
    if (chatType === 'group' && !roomName.trim()) { setMessages([]); setStatus('グループ名を入力してください'); return; }
    const client = supabase;
    let alive = true;
    const load = async () => {
      const { data, error } = await client.from('portal_messages').select('id,user_id,username,content,created_at,room_id')
        .eq('room_id', roomId).order('created_at', { ascending: true }).limit(100);
      if (!alive) return;
      if (error) setStatus(`読み込みエラー: ${error.message}`);
      else { setMessages((data || []) as ChatMessage[]); setStatus('接続済み'); }
    };
    void load();
    const channel = client.channel(`portal-chat-${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portal_messages' }, payload => {
        const m = payload.new as ChatMessage;
        if (m.room_id !== roomId) return;
        setMessages(prev => prev.some(x => String(x.id) === String(m.id)) ? prev : [...prev, m].slice(-100));
      }).subscribe(s => { if (s === 'SUBSCRIBED') setStatus('リアルタイム接続済み'); });
    return () => { alive = false; void client.removeChannel(channel); };
  }, [roomId, chatType, targetUserId, roomName]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text || !supabase || !userId || (chatType === 'direct' && (!targetUserId.trim() || targetUserId.trim() === userId)) || (chatType === 'group' && !roomName.trim())) return;
    setBusy(true);
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ content: text.slice(0, 1000), roomId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || '送信できませんでした');
      setMessages(prev => prev.some(x => String(x.id) === String(result.id)) ? prev : [...prev, result].slice(-100));
      setContent('');
      setStatus('リアルタイム接続済み');
    } catch (e) { setStatus(`送信エラー: ${e instanceof Error ? e.message : '接続エラー'}`); }
    finally { setBusy(false); }
  }

  return <section className="feature-page chat-page">
    <div className="feature-heading"><div><p className="eyebrow">みんなの会話</p><h1><i className="fa-solid fa-comments"/> チャット</h1><p className="page-subtitle">個人チャットやグループで気軽にやりとりできます。</p></div><span className="connection-pill"><i className="fa-solid fa-circle"/>{status}</span></div>
    {!userId && <div className="notice error">チャットを使うにはSennin Accountにログインしてください。</div>}
    <div className="chat-layout">
      <aside className="chat-room-list" aria-label="チャットの種類">
        <button className={`chat-room-option ${chatType === 'general' ? 'selected' : ''}`} onClick={() => setChatType('general')}><i className="fa-solid fa-earth-asia"/><span><b>みんなのチャット</b><small>共通ルーム</small></span></button>
        <button className={`chat-room-option ${chatType === 'direct' ? 'selected' : ''}`} onClick={() => setChatType('direct')}><i className="fa-solid fa-user"/><span><b>個人チャット</b><small>ユーザーIDで相手を指定</small></span></button>
        <button className={`chat-room-option ${chatType === 'group' ? 'selected' : ''}`} onClick={() => setChatType('group')}><i className="fa-solid fa-user-group"/><span><b>グループチャット</b><small>グループ名で参加</small></span></button>
      </aside>
      <div className="chat-workspace">
        {chatType !== 'general' && <div className="chat-room-settings">
          {chatType === 'direct' ? <label>相手のユーザーID<input value={targetUserId} onChange={e => setTargetUserId(e.target.value.trim().slice(0, 160))} placeholder="相手のユーザーID" /></label>
            : <label>グループ名<input value={roomName} onChange={e => setRoomName(e.target.value.slice(0, 60))} placeholder="例：ゲーム好きの部屋" /></label>}
        </div>}
        <div className="chat-window"><div className="chat-room-title"><b>{chatType === 'general' ? 'みんなのチャット' : chatType === 'direct' ? (targetUserId ? `個人チャット · ${targetUserId}` : '個人チャット') : (roomName || 'グループチャット')}</b><small>{messages.length} 件のメッセージ</small></div>
          <div className="chat-messages">{messages.map(m => <article className={`chat-message ${m.user_id === userId ? 'own' : ''}`} key={m.id}><div className="chat-avatar">{(m.username || 'U').slice(0, 1)}</div><div className="chat-bubble"><div className="chat-byline"><b>{m.username || 'ユーザー'}</b><small>{m.user_id === userId ? '自分' : ''} · {new Date(m.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small></div><p>{m.content}</p></div></article>)}{!messages.length && <div className="empty-state"><i className="fa-regular fa-message"/><b>まだメッセージはありません</b><span>最初のメッセージを送ってみましょう。</span></div>}<div ref={bottom}/></div>
          <form className="chat-compose" onSubmit={send}><input value={content} onChange={e => setContent(e.target.value.slice(0, 1000))} placeholder={userId ? 'メッセージを入力…' : 'ログインしてください'} maxLength={1000} disabled={!supabase || !userId || busy}/><span>{content.length}/1000</span><button className="primary-button" disabled={!supabase || !userId || busy || !content.trim() || (chatType === 'direct' && (!targetUserId.trim() || targetUserId.trim() === userId)) || (chatType === 'group' && !roomName.trim())}><i className="fa-solid fa-paper-plane"/> 送信</button></form>
        </div>
      </div>
    </div>
    <p className="chat-footnote"><i className="fa-solid fa-shield-halved"/> 投稿者IDはサーバー側でログインセッションから設定されます。個人チャットを公開運用する場合は、Supabaseの読み取りポリシーにも参加者チェックを設定してください。</p>
  </section>;
}

export function GamePage() {
  const [hideChrome,setHideChrome]=useState(false); const [pos,setPos]=useState({x:0,y:0}); const gameSrc=useRef<string|null>(null); if(!gameSrc.current){const url=new URL('https://cdn.jsdelivr.net/gh/CloudMoonApp/web@main/portal-260605.html');new URLSearchParams(window.location.search).forEach((v,k)=>url.searchParams.set(k,v));url.searchParams.set('t',String(Date.now()));gameSrc.current=url.toString();} const [dragging,setDragging]=useState(false); const offset=useRef({x:0,y:0}); const started=useRef(false); const moved=useRef(false); const origin=useRef({x:0,y:0});
  useEffect(()=>{const move=(e:PointerEvent)=>{if(!started.current)return;if(Math.abs(e.clientX-origin.current.x)+Math.abs(e.clientY-origin.current.y)>8)moved.current=true;if(moved.current)setPos({x:Math.max(0,Math.min(window.innerWidth-180,e.clientX-offset.current.x)),y:Math.max(0,Math.min(window.innerHeight-60,e.clientY-offset.current.y))});};const up=()=>{started.current=false;setDragging(false);if(moved.current)window.setTimeout(()=>{moved.current=false;},0);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};},[]);
  const start=(e:PointerEvent<HTMLButtonElement>)=>{const r=e.currentTarget.getBoundingClientRect();offset.current={x:e.clientX-r.left,y:e.clientY-r.top};origin.current={x:e.clientX,y:e.clientY};started.current=true;moved.current=false;try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}setDragging(true);};
  return <section className={`game-page ${hideChrome?'game-immersive':''}`}><div className="game-topline"><div><p className="eyebrow">好きなゲームで遊ぶ</p><h1>ゲーム</h1></div><span>外部ゲームポータル</span></div><div className="game-frame-wrap"><iframe className="game-frame" title="ゲームポータル" src={gameSrc.current} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-downloads" allow="fullscreen; autoplay; gamepad; clipboard-read; clipboard-write" allowFullScreen loading="eager" referrerPolicy="no-referrer"/><div className="game-frame-cover" aria-hidden="true"/></div><button className={`floating-game-toggle ${dragging?'dragging':''}`} style={pos.x||pos.y?{left:pos.x,top:pos.y}:undefined} onPointerDown={start} onClick={()=>{if(!moved.current)setHideChrome(v=>!v);moved.current=false;}} title="ドラッグして移動できます。クリックでサイドバーとフッターを切り替えます。"><i className={`fa-solid ${hideChrome?'fa-eye':'fa-eye-slash'}`}/><span>{hideChrome?'メニューを表示':'メニューを隠す'}</span><i className="fa-solid fa-grip-vertical drag-grip"/></button></section>;
}
