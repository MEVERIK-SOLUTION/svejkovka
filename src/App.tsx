/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Beer, Flame, MapPin, Camera, Mic, Send, Smile, History, Image as ImageIcon, X, History as HistoryIcon, Share2, Check, Footprints, Trophy, User, Volume2, VolumeX, LogIn, LogOut, Settings } from 'lucide-react';
import { getShvejkAnalysis, ShvejkResponse } from './services/geminiService';
import { playSound, stopSound, setMuted, getMuted } from './lib/sounds';
import MilitaryMap from './components/MilitaryMap';
import ProfileModal from './components/ProfileModal';

// Firebase
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useDocumentData, useCollectionData } from 'react-firebase-hooks/firestore';
import { doc, setDoc, collection, query, where, orderBy, serverTimestamp, addDoc } from 'firebase/firestore';

interface Message {
  id: string;
  sender: 'user' | 'shvejk';
  text?: string;
  image?: string;
  response?: ShvejkResponse;
  timestamp: any; // Using timestamp from Firebase or Date
}

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  height?: number;
  weight?: number;
  age?: number;
  gender?: 'male' | 'female' | 'other';
}

interface Stats {
  alcohol: number;
  calories: number;
  mood: string;
}

export default function App() {
  const [user] = useAuthState(auth);
  const [userProfileData] = useDocumentData(user ? doc(db, 'users', user.uid) : null);
  const profile = userProfileData as UserProfile | undefined;

  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [dbMessages] = useCollectionData(user ? query(collection(db, 'reports'), where('userId', '==', user.uid), orderBy('timestamp', 'asc')) : null);
  
  const [inputText, setInputText] = useState('');
  const [stats, setStats] = useState<Stats>({ alcohol: 0, calories: 0, mood: 'Vynikající' });
  const [activeTab, setActiveTab] = useState('Marš');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(getMuted());
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  // Combine messages
  const allMessages = [...(dbMessages?.map(m => ({ 
    ...m, 
    id: m.id || Math.random().toString(), 
    timestamp: m.timestamp?.toDate() || new Date(),
    sender: m.sender || 'shvejk' // Mapping db format if needed
  })) || []), ...localMessages] as Message[];

  // Stats calculation based on messages
  useEffect(() => {
    if (allMessages.length > 0) {
      let totalAlc = 0;
      let totalCal = 0;
      allMessages.forEach(m => {
        if (m.response) {
          totalAlc += m.response.alcohol_est || 0;
          totalCal += m.response.calories_est || 0;
        }
      });
      setStats(prev => ({ 
        ...prev, 
        alcohol: Number(totalAlc.toFixed(2)), 
        calories: Math.round(totalCal) 
      }));
    }
  }, [allMessages]);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        // Init profile if new
        const userDoc = doc(db, 'users', result.user.uid);
        try {
          await setDoc(userDoc, {
            uid: result.user.uid,
            displayName: result.user.displayName,
            email: result.user.email,
            photoURL: result.user.photoURL,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${result.user.uid}`);
        }
        playSound('SUCCESS');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setLocalMessages([]);
    playSound('CLICK');
  };
  
  const [isRecording, setIsRecording] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const handleShare = async (msg: Message) => {
    playSound('CLICK');
    const textToShare = msg.response?.shvejk_comment || msg.text || '';
    if (!textToShare) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Hlášení Josefa Švejka',
          text: textToShare,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(textToShare);
        setCopiedId(msg.id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch (error) {
      console.error('Sharing failed', error);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && ('WebkitSpeechRecognition' in window || 'speechRecognition' in window)) {
      const SpeechRecognition = (window as any).WebkitSpeechRecognition || (window as any).speechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'cs-CZ';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsRecording(false);
        stopSound('RECORDING');
        handleSend(transcript);
      };

      recognitionRef.current.onerror = () => {
        setIsRecording(false);
        stopSound('RECORDING');
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
        stopSound('RECORDING');
      };
    }
  }, []);

  const toggleRecording = () => {
    playSound('CLICK');
    if (isRecording) {
      recognitionRef.current?.stop();
      stopSound('RECORDING');
    } else {
      setIsRecording(true);
      recognitionRef.current?.start();
      playSound('RECORDING', true);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages, isTyping]);

  const handleSend = async (text: string = inputText, image: string | null = selectedImage) => {
    if (!text.trim() && !image) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: text,
      image: image || undefined,
      timestamp: new Date(),
    };

    setLocalMessages(prev => [...prev, newMessage]);
    setInputText('');
    setSelectedImage(null);
    setIsTyping(true);
    playSound('STAMP');

    try {
      const response = await getShvejkAnalysis(
        text || "Poslušně hlásím, posílám obrázek!", 
        image || undefined,
        stats,
        profile
      );
      
      const shvejkMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'shvejk',
        response: response,
        timestamp: new Date(),
      };

      if (user) {
        // Save to Firestore
        const reportsColl = collection(db, 'reports');
        try {
          await addDoc(reportsColl, {
            userId: user.uid,
            text: text || "",
            image: image || null,
            timestamp: serverTimestamp(),
            shvejk_comment: response.shvejk_comment,
            alcohol_est: response.alcohol_est,
            calories_est: response.calories_est,
            location_fact: response.location_fact
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'reports');
        }
        // Remove from local so it doesn't double show (dbMessages will pick it up)
        setLocalMessages(prev => prev.filter(m => m.id !== newMessage.id));
      } else {
        setLocalMessages(prev => [...prev, shvejkMsg]);
      }

      playSound('RECEIVE');
      playSound('SUCCESS');
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    playSound('CLICK');
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = reader.result as string;
        setSelectedImage(img);
        handleSend("", img);
      };
      reader.readAsDataURL(file);
    }
  };

  const updateMood = (m: string) => {
    playSound('CLICK');
    setStats(prev => ({ ...prev, mood: m }));
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setMuted(nextMuted);
    if (!nextMuted) {
      playSound('CLICK');
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col max-w-4xl mx-auto border-4 sm:border-[16px] border-[#1a2f4c] bg-[#f4ebd0] text-[#1a2f4c] shadow-2xl overflow-hidden font-sans">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 p-3 sm:p-4 border-b-2 sm:border-b-4 border-[#1a2f4c] flex justify-between items-center bg-[#f4ebd0] shadow-md">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-[#1a2f4c] bg-[#b8974a] flex items-center justify-center text-white font-black shadow-inner overflow-hidden shrink-0">
             <span className="text-lg sm:text-xl">🎖️</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg sm:text-2xl font-black tracking-tighter leading-none uppercase font-serif">C. a k. polní deník</h1>
            <p className="text-[8px] sm:text-[10px] italic uppercase tracking-widest opacity-80 text-[#b8974a] font-bold">Švejkův Maršál v.1.2</p>
          </div>
        </div>
        <div className="text-right flex items-center gap-2 sm:gap-4">
          <button 
            onClick={toggleMute}
            className="p-1.5 sm:p-2 hover:bg-[#1a2f4c]/10 rounded-full transition-colors flex items-center justify-center border-2 border-[#1a2f4c]/10"
            title={isMuted ? "Zapnout zvuky" : "Vypnout zvuky"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 opacity-40" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
          
          <div className="hidden md:block">
            <p className="text-[10px] font-bold uppercase opacity-60">Jednotka</p>
            <p className="text-xs font-black italic text-[#8b0000]">{user ? user.displayName?.split(' ')[0].toUpperCase() : 'NENASTOUPILA'}</p>
          </div>

          {user ? (
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="w-10 h-10 rounded-full border-2 border-[#1a2f4c] bg-[#d9c2a3] flex items-center justify-center overflow-hidden hover:scale-110 transition-transform relative group"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">💂</span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Settings className="w-4 h-4 text-white" />
              </div>
            </button>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 bg-[#1a2f4c] text-[#f4ebd0] px-3 py-2 rounded-sm font-black text-[10px] uppercase tracking-widest hover:bg-[#b8974a] transition-colors"
            >
              <LogIn className="w-4 h-4" /> Vstup
            </button>
          )}
        </div>
      </header>

      {/* Tabs Navigation - Fixed Bottom */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl flex border-t-4 border-[#1a2f4c] bg-[#efdfc4] z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        {[
          { name: 'Marš', icon: '🎖️' },
          { name: 'Hlášení', icon: '📜' },
          { name: 'Kantýna', icon: '🍺' }
        ].map((tab) => (
          <motion.button
            key={tab.name}
            whileHover={{ backgroundColor: activeTab === tab.name ? '#1a2f4c' : 'rgba(26, 47, 76, 0.08)' }}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              setActiveTab(tab.name);
              playSound('CLICK');
            }}
            className={`flex-1 py-4 flex flex-col items-center gap-1 font-black text-[11px] uppercase tracking-wider transition-all border-r-2 border-[#1a2f4c] last:border-r-0 relative overflow-hidden ${
              activeTab === tab.name 
                ? 'bg-[#1a2f4c] text-[#fdfaf1]' 
                : 'text-[#1a2f4c]'
            }`}
          >
            {activeTab === tab.name && (
              <motion.div 
                layoutId="activeTab"
                className="absolute inset-0 bg-[#1a2f4c] -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <motion.span 
              animate={{ scale: activeTab === tab.name ? 1.2 : 1 }}
              className="text-xl mb-0.5"
            >
              {tab.icon}
            </motion.span>
            {tab.name}
          </motion.button>
        ))}
      </nav>

      <div className="flex-1 flex flex-col overflow-hidden pb-24">
        {activeTab === 'Marš' && (
          <div className="flex-1 flex flex-col p-3 sm:p-8 space-y-4 sm:space-y-8 h-full overflow-hidden">
            {/* Interactive Military Map */}
            <div className="flex-1 min-h-[350px] bg-[#d1d1b8] border-4 sm:border-[12px] border-[#3e342a] shadow-[inset_0_0_40px_rgba(0,0,0,0.2),10px_10px_20px_rgba(0,0,0,0.3)] relative overflow-hidden">
               <MilitaryMap />
            </div>

            {/* Huge 3D Call to Action - Redesigned for mobile responsiveness */}
            <div className="flex flex-col items-center justify-center gap-6 sm:gap-8 py-2 px-4 sm:px-12">
              <div className="flex items-center justify-center gap-2 sm:gap-12 w-full">
                {/* Hand-drawn Camera Icon */}
                <motion.button 
                  whileHover={{ scale: 1.1, rotate: -5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center p-2 text-[#1a2f4c] transition-transform"
                >
                  <svg className="w-10 h-10 sm:w-14 sm:h-14" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 35 L80 35 L85 45 L85 85 L15 85 L15 45 Z" />
                    <circle cx="50" cy="62" r="15" />
                    <rect x="40" y="25" width="20" height="10" />
                  </svg>
                  <span className="block text-[8px] font-black mt-1 uppercase tracking-widest text-center">Foto</span>
                </motion.button>

                {/* Main POSLUŠNĚ HLÁSÍM Button */}
                <motion.button
                  whileHover={{ 
                    scale: 1.05,
                    filter: "brightness(1.1)",
                  }}
                  whileTap={{ 
                    scale: 0.92, 
                    y: 6,
                  }}
                  animate={!isRecording ? { 
                    scale: [1, 1.02, 1],
                    boxShadow: [
                      "0 10px 0 #9a7e3a, 0 15px 20px rgba(0,0,0,0.2)", 
                      "0 12px 0 #9a7e3a, 0 20px 30px rgba(0,0,0,0.3)", 
                      "0 10px 0 #9a7e3a, 0 15px 20px rgba(0,0,0,0.2)"
                    ]
                  } : {
                    scale: [1, 1.05, 1],
                    boxShadow: "0 4px 0 #4a0000"
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  onClick={() => {
                    toggleRecording();
                  }}
                  className={`w-36 h-36 sm:w-56 sm:h-56 rounded-full flex items-center justify-center text-center p-4 sm:p-8 transition-colors duration-300 relative group active:duration-75 shrink-0
                    ${isRecording ? 'bg-red-700' : 'bg-[#b8974a] hover:bg-[#c9a85b]'}
                    border-4 sm:border-8 border-[#1a2f4c]
                  `}
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/30 to-transparent pointer-events-none"></div>
                  
                  {/* Dynamic Ring */}
                  <AnimatePresence>
                    {isRecording && (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="absolute inset-0 border-4 border-red-500 rounded-full pointer-events-none"
                      />
                    )}
                  </AnimatePresence>

                  <span className={`text-base sm:text-2xl font-black uppercase tracking-tighter font-serif leading-tight relative z-10 ${isRecording ? 'text-white' : 'text-[#1a2f4c]'}`}>
                    {isRecording ? 'POSLOUCHÁM...' : 'POSLUŠNĚ HLÁSÍM'}
                  </span>
                  
                  {/* Polish shine effect enhancement */}
                  <motion.div 
                    animate={{ 
                      x: [-100, 300],
                      opacity: [0, 0.5, 0]
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      repeatDelay: 2
                    }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] pointer-events-none"
                  />
                </motion.button>

                {/* Hand-drawn Mic Icon */}
                <motion.button 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleRecording}
                  className={`flex flex-col items-center p-2 transition-all ${isRecording ? 'text-red-700' : 'text-[#1a2f4c]'}`}
                >
                  <svg className="w-10 h-10 sm:w-14 sm:h-14" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="35" y="20" width="30" height="45" rx="15" />
                    <path d="M20 50 Q20 80 50 80 Q80 80 80 50" />
                    <line x1="50" y1="80" x2="50" y2="95" />
                    <line x1="30" y1="95" x2="70" y2="95" />
                  </svg>
                  <span className="block text-[8px] font-black mt-1 uppercase tracking-widest text-center">Hlas</span>
                </motion.button>
              </div>

              {/* Status/Last Activity Peek */}
              <div className="w-full max-w-sm bg-[#1a2f4c]/5 border-2 border-dashed border-[#1a2f4c]/20 p-3 sm:p-4 font-serif italic text-[10px] sm:text-sm text-center">
                 {allMessages.length > 0 
                  ? `Posl. akce: "${allMessages[allMessages.length - 1].sender === 'user' ? allMessages[allMessages.length - 1].text : allMessages[allMessages.length - 1].response?.shvejk_comment?.substring(0, 40) + '...'}"`
                  : "Žádné hlášení v polní poště."}
              </div>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              className="hidden" 
              accept="image/*"
            />
          </div>
        )}

        {activeTab === 'Hlášení' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-12 bg-[#efdfc4] scroll-smooth">
            <h2 className="text-3xl font-black uppercase tracking-tighter font-serif border-b-4 border-[#1a2f4c] pb-2 mb-8 flex items-center gap-3">
              <HistoryIcon className="w-8 h-8" /> Polní zpravodaj
            </h2>
            
            <AnimatePresence mode="popLayout">
              {[...allMessages].reverse().map((msg, index) => (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, y: 30, rotate: index % 2 === 0 ? -1 : 1 }}
                  animate={{ opacity: 1, y: 0, rotate: index % 2 === 0 ? -0.5 : 0.5 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => {
                    setExpandedMessageId(expandedMessageId === msg.id ? null : msg.id);
                    playSound('CLICK');
                  }}
                  className={`relative bg-[#fdfaf1] border-2 border-black shadow-[5px_5px_0px_rgba(0,0,0,0.1)] p-6 sm:p-8 m-2 font-serif group hover:shadow-[8px_8px_0px_rgba(0,0,0,0.15)] transition-shadow overflow-hidden cursor-pointer ${expandedMessageId === msg.id ? 'z-20 shadow-[12px_12px_0px_rgba(0,0,0,0.15)]' : ''}`}
                  style={{ borderRadius: index % 2 === 0 ? '2px 4px 3px 6px / 4px 3px 6px 2px' : '4px 2px 6px 3px / 3px 6px 2px 4px' }}
                >
                  {/* Parchment Texture Overlay */}
                  <div className="absolute inset-0 opacity-[0.12] pointer-events-none z-0" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/parchment.png")' }}></div>
                  
                  <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none overflow-hidden z-10">
                    <div className="text-8xl transform rotate-12 scale-150">軍</div>
                  </div>

                  <div className="relative z-10 flex justify-between items-start mb-6 border-b border-black/10 pb-2">
                    <div>
                      <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-black/50">Odesílatel</p>
                      <p className="text-lg font-black uppercase">Vojín {msg.sender === 'user' ? (user?.displayName || 'neznámý') : 'Josef Švejk'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-black/50">Čas hlášení</p>
                      <p className="font-bold">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedMessageId === msg.id && msg.image && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="relative z-10 mb-6 border-2 border-black p-1 bg-white overflow-hidden"
                      >
                        <img src={msg.image} alt="Hlášení" className="w-full h-64 object-cover sepia-[0.3]" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="relative z-10 space-y-6">
                    {msg.text && (
                      <p className={`text-xl italic leading-relaxed text-[#1a2f4c]/80 border-l-2 border-[#1a2f4c]/10 pl-4 ${expandedMessageId === msg.id ? '' : 'line-clamp-2'}`}>
                        "{msg.text}"
                      </p>
                    )}

                    <AnimatePresence>
                      {expandedMessageId === msg.id && msg.response && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0, marginTop: 0 }}
                          animate={{ height: 'auto', opacity: 1, marginTop: 24 }}
                          exit={{ height: 0, opacity: 0, marginTop: 0 }}
                          className="overflow-hidden space-y-6"
                        >
                          <div className="bg-[#fff9c4]/50 p-6 border-l-4 border-[#b8974a] shadow-inner">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#b8974a] mb-2">Komentář dohlížitele</p>
                            <p className="text-2xl font-black italic leading-tight text-[#1a2f4c]">
                              "{msg.response.shvejk_comment}"
                            </p>
                          </div>

                          {msg.response.location_fact && (
                            <div className="bg-[#1a2f4c]/5 p-4 border border-dashed border-[#1a2f4c]/20">
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> Historický fakt
                              </p>
                              <p className="text-sm font-medium leading-snug">
                                {msg.response.location_fact}
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="relative z-10 mt-8 flex flex-wrap items-center gap-3">
                    {msg.response && (
                      <>
                        <div className="bg-[#1a2f4c] text-[#f4ebd0] px-3 py-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 rounded-sm shadow-sm">
                          <Beer className="w-3 h-3" /> +{msg.response.alcohol_est} ‰
                        </div>
                        <div className="bg-[#b8974a] text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 rounded-sm shadow-sm">
                          <Flame className="w-3 h-3" /> {msg.response.calories_est} kcal
                        </div>
                      </>
                    )}
                    
                    <div className="ml-auto flex items-center gap-2">
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-30 group-hover:opacity-60 transition-opacity">
                         {expandedMessageId === msg.id ? 'Sbalit hlášení' : 'Rozbalit detaily'}
                       </p>
                       <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(msg);
                        }}
                        className="p-2 hover:bg-black/5 rounded-full transition-colors"
                      >
                        <Share2 className="w-4 h-4 opacity-40 hover:opacity-100" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {activeTab === 'Kantýna' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-10 bg-[#f4ebd0]">
            <h2 className="text-3xl font-black uppercase tracking-tighter font-serif border-b-4 border-[#1a2f4c] pb-2 mb-8 flex items-center gap-3">
              <Beer className="w-8 h-8" /> Polní Kantýna
            </h2>

            {/* Promile-O-Metr */}
            <div className="shvejk-card flex flex-col items-center justify-center p-10 bg-white/50 backdrop-blur-sm relative overflow-hidden">
              {/* Bubbles effect for high alcohol level */}
              {stats.alcohol > 1.2 && (
                <div className="absolute inset-x-0 bottom-0 top-1/2 pointer-events-none z-0 overflow-hidden flex justify-around items-end">
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ y: 20, opacity: 0, scale: 0.5 }}
                      animate={{ 
                        y: [-20, -150], 
                        opacity: [0, 0.6, 0],
                        scale: [0.5, 1.2, 0.8],
                        x: [0, Math.sin(i) * 30, 0]
                      }}
                      transition={{ 
                        duration: 2 + Math.random() * 2, 
                        repeat: Infinity, 
                        delay: i * 0.4,
                        ease: "easeOut"
                      }}
                      className="w-4 h-4 rounded-full border-2 border-[#f97316]/30 bg-[#f97316]/10"
                    />
                  ))}
                </div>
              )}

              <p className="text-xs font-black uppercase tracking-[0.3em] mb-6 opacity-60 relative z-10">Aktuální lihoměr</p>
              
              <div className="relative w-64 h-32 overflow-hidden relative z-10">
                <svg className="w-64 h-64" viewBox="0 0 100 100">
                  <path d="M 20 80 A 40 40 0 0 1 80 80" fill="none" stroke="#e5e7eb" strokeWidth="12" strokeLinecap="round" />
                  <motion.path 
                    d="M 20 80 A 40 40 0 0 1 80 80" 
                    fill="none" 
                    stroke={stats.alcohol < 0.5 ? '#22c55e' : stats.alcohol < 1.5 ? '#f97316' : '#ef4444'} 
                    strokeWidth="12" 
                    strokeLinecap="round"
                    initial={{ strokeDasharray: "0 100" }}
                    animate={{ strokeDasharray: `${Math.min(stats.alcohol * 20, 100)} 100` }}
                    transition={{ duration: 1.5, type: "spring", bounce: 0 }}
                  />
                </svg>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                  <motion.p 
                    key={stats.alcohol}
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.1, 1] }}
                    className="text-5xl font-black"
                  >
                    {stats.alcohol}
                  </motion.p>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Promile (procent)</p>
                </div>
              </div>

              <div className="mt-8 text-center bg-[#1a2f4c] text-[#f4ebd0] px-6 py-3 rounded-full shadow-lg border-2 border-[#b8974a] relative z-10">
                 <p className="text-xs font-bold uppercase tracking-widest">
                   {stats.alcohol === 0 ? 'Stav: Střízliv' : 
                    stats.alcohol < 1 ? 'Stav: Lehká špička' : 
                    'Stav: Putimský drak'}
                 </p>
                 <p className="text-[10px] italic opacity-70 mt-1 uppercase font-black">
                   {stats.alcohol === 0 ? 'Schopen pochodu a bojového nasazení' : 
                    stats.alcohol < 1 ? 'Schopen pochodu, leč mírně vrávorá' : 
                    'Neschopen pochodu, nutno naložit na vůz'}
                 </p>
              </div>
            </div>

            {/* Bitevní statistiky */}
            <div className="grid grid-cols-2 gap-6">
              <div className="shvejk-card p-8 flex flex-col items-center justify-center text-center group hover:bg-[#1a2f4c] hover:text-[#f4ebd0] transition-colors">
                 <Flame className="w-12 h-12 mb-4 text-[#8b0000] group-hover:text-white" />
                 <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">Spálený sádlo</p>
                 <p className="text-4xl font-black">{stats.calories}</p>
                 <p className="text-[8px] font-bold uppercase">kalorií</p>
              </div>
              <div className="shvejk-card p-8 flex flex-col items-center justify-center text-center group hover:bg-[#1a2f4c] hover:text-[#f4ebd0] transition-colors">
                 <Footprints className="w-12 h-12 mb-4 text-[#1a2f4c] group-hover:text-white" />
                 <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">Ušlá anabáze</p>
                 <p className="text-4xl font-black">{(stats.calories / 130).toFixed(1)}</p>
                 <p className="text-[8px] font-bold uppercase">kilometrů</p>
              </div>
            </div>

            {/* Leaderboard - Chalkboard */}
            <div className="bg-[#0f1a0f] border-[12px] border-[#3e2723] rounded-sm p-6 shadow-2xl relative overflow-hidden">
               <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/black-felt.png')]"></div>
               <h3 className="text-2xl font-chalk uppercase tracking-widest text-[#f5f5f5] text-center mb-8 border-b-2 border-[#f5f5f5]/20 pb-4">
                  🏆 Tabule slávy u Černého orla
               </h3>
               
               <table className="w-full text-[#f5f5f5] font-chalk text-lg">
                  <thead>
                     <tr className="border-b border-[#f5f5f5]/10">
                        <th className="text-left py-2 px-2 opacity-60">Vojín</th>
                        <th className="text-right py-2 px-2 opacity-60">Promile</th>
                        <th className="text-right py-2 px-2 opacity-60">Km</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr className="border-b border-[#f5f5f5]/5">
                        <td className="py-4 px-2 flex items-center gap-3">
                           <span className="text-yellow-400">1.</span> Kadet Biegler
                        </td>
                        <td className="text-right py-4 px-2 text-yellow-400 font-bold">2.4 ‰</td>
                        <td className="text-right py-4 px-2 opacity-80">14.2</td>
                     </tr>
                     <tr className="border-b border-[#f5f5f5]/5">
                        <td className="py-4 px-2 flex items-center gap-3">
                           <span className="text-gray-300">2.</span> {user ? user.displayName : 'Vojín v zácviku'} (VY)
                        </td>
                        <td className="text-right py-4 px-2 font-bold">{stats.alcohol} ‰</td>
                        <td className="text-right py-4 px-2 opacity-80">{(stats.calories / 130).toFixed(1)}</td>
                     </tr>
                     <tr className="">
                        <td className="py-4 px-2 flex items-center gap-3">
                           <span className="text-amber-600">3.</span> Baloun
                        </td>
                        <td className="text-right py-4 px-2 font-bold">0.8 ‰</td>
                        <td className="text-right py-4 px-2 opacity-80">42.0</td>
                     </tr>
                  </tbody>
               </table>
               
               <div className="mt-8 pt-4 border-t border-[#f5f5f5]/20 text-center text-[#f5f5f5]/40 text-[10px] italic uppercase tracking-widest">
                  Aktualizováno polním kurýrem před 15 minutami
               </div>
            </div>
          </div>
        )}
      </div>

      <footer className="hidden p-6 bg-[#1a2f4c] text-[#f4ebd0] sm:flex flex-col sm:flex-row justify-between items-center text-[10px] font-bold uppercase tracking-widest shrink-0">
        <span className="opacity-60">© 1914—2026 C.K. Informační Služba</span>
        <span className="text-[#b8974a]">Písek — Zátaví — Putim</span>
        <span className="opacity-60">Kaiser-Josef-Gasse 1, Písek</span>
      </footer>

      <ProfileModal 
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={profile}
        onLogout={handleLogout}
      />
    </div>
  );
}

