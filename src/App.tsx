/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Beer, Flame, MapPin, Camera, Mic, Send, Smile, History, Image as ImageIcon, X, History as HistoryIcon, Share2, Check, Footprints, Trophy, User, Volume2, VolumeX, LogIn, LogOut, Settings, ScrollText, Wine, Navigation, Target, Map as MapIcon } from 'lucide-react';
import { getShvejkAnalysis, ShvejkResponse } from './services/geminiService';
import { playSound, stopSound, setMuted, getMuted } from './lib/sounds';
import MilitaryMap, { routePositions } from './components/MilitaryMap';
import ProfileModal from './components/ProfileModal';
import NatureAnalysis from './components/NatureAnalysis';
import WeatherWidget from './components/WeatherWidget';
import { historizeImage } from './services/vintageImageService';

// Firebase
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useDocumentData, useCollectionData } from 'react-firebase-hooks/firestore';
import { doc, setDoc, collection, query, where, orderBy, serverTimestamp, addDoc, limit } from 'firebase/firestore';

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
  // Use 'messages' instead of 'reports', and fetch ALL messages (collaborative)
  const [dbMessages] = useCollectionData(query(collection(db, 'messages'), orderBy('timestamp', 'desc'), limit(50)));
  
  // Use global stats for leaderboard
  const [globalStats] = useCollectionData(query(collection(db, 'stats'), orderBy('currentAlcohol', 'desc'), limit(10)));
  
  const [inputText, setInputText] = useState('');
  const [stats, setStats] = useState<Stats>({ alcohol: 0, calories: 0, mood: 'Vynikající' });
  const [activeTab, setActiveTab] = useState('Marš');
  const [isTyping, setIsTyping] = useState(false);
  const [isStylizing, setIsStylizing] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(getMuted());

  // March Log States
  const [marchDistance, setMarchDistance] = useState("5");
  const [marchMinutes, setMarchMinutes] = useState("60");

  // Calculate distance of the route
  const getRouteDistance = () => {
    let total = 0;
    for (let i = 0; i < routePositions.length - 1; i++) {
      const p1 = routePositions[i];
      const p2 = routePositions[i + 1];
      const rad = Math.PI / 180;
      const dLat = (p2.lat - p1.lat) * rad;
      const dLon = (p2.lng - p1.lng) * rad;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(p1.lat * rad) * Math.cos(p2.lat * rad) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      total += 6371 * c; // Radius of Earth in km
    }
    return total;
  };

  const handleUseMapDistance = () => {
    const dist = getRouteDistance();
    setMarchDistance(dist.toFixed(1));
    playSound('CLICK');
  };

  const handleLogMarch = async () => {
    if (!user) return;
    const dist = parseFloat(marchDistance);
    const mins = parseFloat(marchMinutes);
    if (isNaN(dist) || isNaN(mins)) return;

    const pace = mins / dist;
    const caloriesBurned = Math.round(dist * (userProfileData?.weight || 80) * 1.03);
    const steps = Math.round(dist * 1312);

    playSound('SUCCESS');
    handleSend(`Hlásím ústup/postup! Ušel jsem ${dist} km za ${mins} minut (tempo ${pace.toFixed(1)} min/km). Spáleno cca ${caloriesBurned} kcal a ujeto ${steps} kroků.`, undefined, {
      calories_est: caloriesBurned,
      march_data: { distance: dist, time: mins, pace, steps }
    });
  };

  const handleAddBeer = () => {
    if (!user) return;
    playSound('CLICK');
    // Simplified Widmark formula roughly for 0.5l beer for 80kg male
    const alcoholGain = 0.3; 
    handleSend("Poslušně hlásím, jedno orosené pivo padlo za vlast!", undefined, {
      alcohol_est: alcoholGain
    });
  };

  const handleAddRum = () => {
    if (!user) return;
    playSound('CLICK');
    const alcoholGain = 0.2; 
    handleSend("Štamprle rumu na zahřátí morálky!", undefined, {
      alcohol_est: alcoholGain
    });
  };
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  // Combine messages using useMemo to prevent infinite loops
  const allMessages = React.useMemo(() => {
    const dbMsgs = dbMessages?.map(m => ({ 
      ...m, 
      id: m.id || m.timestamp?.seconds?.toString() || 'shvejk-msg', 
      timestamp: m.timestamp?.toDate() || new Date(),
      sender: m.sender || 'shvejk' 
    })) || [];
    return [...dbMsgs.reverse(), ...localMessages] as Message[];
  }, [dbMessages, localMessages]);

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
      
      const newAlc = Number(totalAlc.toFixed(2));
      const newCal = Math.round(totalCal);

      // Only update if values actually changed to prevent infinite loops
      setStats(prev => {
        if (prev.alcohol === newAlc && prev.calories === newCal) return prev;
        return { 
          ...prev, 
          alcohol: newAlc, 
          calories: newCal 
        };
      });
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
  const [interimTranscript, setInterimTranscript] = useState('');
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'cs-CZ';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let currentInterim = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setInputText(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + finalTranscript);
        }
        setInterimTranscript(currentInterim);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
        stopSound('RECORDING');
      };

      recognitionRef.current.onend = () => {
        // Only stop if we're supposed to be stopped
        if (isRecording) {
            try { recognitionRef.current?.start(); } catch(e) {}
        }
      };
    }
  }, [isRecording]);

  const toggleRecording = () => {
    playSound('CLICK');
    if (isRecording) {
      setIsRecording(false);
      recognitionRef.current?.stop();
      stopSound('RECORDING');
      setInterimTranscript('');
      
      // If we have text, send it
      if (inputText.trim()) {
        handleSend(inputText);
      }
    } else {
      setIsRecording(true);
      setInputText('');
      setInterimTranscript('');
      try {
        recognitionRef.current?.start();
        playSound('RECORDING', true);
      } catch (e) {
        console.error("Failed to start recognition", e);
        setIsRecording(false);
      }
    }
  };

  const startCamera = async () => {
    playSound('CLICK');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      // Fallback to file input if camera fails
      fileInputRef.current?.click();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        // Compress slightly for Firestore/Gemini
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        stopCamera();
        setSelectedImage(dataUrl);
        setIsNoteOpen(true);
      }
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages, isTyping]);

  const handleSend = async (text: string = inputText, image: string | null = selectedImage, manualMeta?: any) => {
    if (!text.trim() && !image && !manualMeta) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: text,
      image: image || undefined,
      response: manualMeta || undefined,
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
        const reportsColl = collection(db, 'messages');
        try {
          await addDoc(reportsColl, {
            userId: user.uid,
            userName: user.displayName || 'Vojín',
            userPhoto: user.photoURL,
            text: text || "",
            image: image || null,
            timestamp: serverTimestamp(),
            sender: 'user', 
            response: {
              ...(response || {}),
              ...(manualMeta || {})
            },
            shvejk_comment: response?.shvejk_comment || manualMeta?.shvejk_comment || "",
            alcohol_est: response?.alcohol_est || manualMeta?.alcohol_est || 0,
            calories_est: response?.calories_est || manualMeta?.calories_est || 0,
            location_fact: response?.location_fact || ""
          });

          // Update user stats
          const userStatsDoc = doc(db, 'stats', user.uid);
          await setDoc(userStatsDoc, {
            userId: user.uid,
            userName: user.displayName || 'Vojín',
            userPhoto: user.photoURL,
            totalCalories: (stats.calories + (response.calories_est || 0)),
            currentAlcohol: Number((stats.alcohol + (response.alcohol_est || 0)).toFixed(2)),
            lastUpdate: serverTimestamp()
          }, { merge: true });

        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'messages');
        }
        // Remove from local so it doesn't double show
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
        setIsNoteOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStylize = async () => {
    if (!selectedImage || isStylizing) return;
    setIsStylizing(true);
    playSound('CLICK');
    try {
      const styled = await historizeImage(selectedImage);
      if (styled) {
        setSelectedImage(styled);
        playSound('SUCCESS');
      }
    } finally {
      setIsStylizing(false);
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

  // Unit statistics (Aggregate)
  const totalUnitCalories = globalStats?.reduce((acc, s) => acc + (s.totalCalories || 0), 0) || 0;
  const avgUnitAlcohol = globalStats?.length 
    ? (globalStats.reduce((acc, s) => acc + (s.currentAlcohol || 0), 0) / globalStats.length).toFixed(2) 
    : 0;

  return (
    <div className="min-h-screen h-[100dvh] flex flex-col max-w-4xl mx-auto border-4 sm:border-[16px] border-[#1a2f4c] bg-[#f4ebd0] text-[#1a2f4c] shadow-2xl font-sans relative overflow-hidden">
      {/* Sticky Header */}
      <header className="flex-none z-30 p-2 sm:p-4 border-b-2 sm:border-b-4 border-[#1a2f4c] flex justify-between items-center bg-[#f4ebd0] shadow-md">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 border-[#1a2f4c] bg-[#b8974a] flex items-center justify-center text-white font-black shadow-inner overflow-hidden shrink-0">
             <span className="text-base sm:text-xl">🎖️</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm sm:text-2xl font-black tracking-tighter leading-none uppercase font-serif">C. a k. polní deník</h1>
            <p className="text-[7px] sm:text-[10px] italic uppercase tracking-widest opacity-80 text-[#b8974a] font-bold">
              Síla sboru: {globalStats?.length || 0} mužů • Švejkův Maršál v.1.2
            </p>
          </div>
        </div>
        <div className="text-right flex items-center gap-1.5 sm:gap-4">
          <button 
            onClick={toggleMute}
            className="p-1 sm:p-2 hover:bg-[#1a2f4c]/10 rounded-full transition-colors flex items-center justify-center border-2 border-[#1a2f4c]/10"
            title={isMuted ? "Zapnout zvuky" : "Vypnout zvuky"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 opacity-40" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
          
          <div className="hidden md:block text-right mr-2 sm:mr-4">
            <p className="text-[10px] font-bold uppercase opacity-60">Jednotka</p>
            <p className="text-xs font-black italic text-[#8b0000]">{user ? user.displayName?.split(' ')[0].toUpperCase() : 'NENASTOUPILA'}</p>
          </div>

          {user ? (
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-[#1a2f4c] bg-[#d9c2a3] flex items-center justify-center overflow-hidden hover:scale-110 transition-transform relative group shrink-0"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm sm:text-lg">💂</span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Settings className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              </div>
            </button>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-1 bg-[#1a2f4c] text-[#f4ebd0] px-2 sm:px-3 py-1.5 sm:py-2 rounded-sm font-black text-[8px] sm:text-[10px] uppercase tracking-widest hover:bg-[#b8974a] transition-colors shrink-0"
            >
              <LogIn className="w-3 h-3 sm:w-4 sm:h-4" /> Vstup
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area - Scrollable with padding for bottom nav */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth bg-[#efdfc4]/30">
        <div className="pb-32 sm:pb-8 flex flex-col h-full"> 
          <AnimatePresence mode="wait">
            {activeTab === 'Marš' && (
              <motion.div 
                key="mars"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-2 sm:p-8 space-y-4 sm:space-y-6"
              >
                {/* Weather Update */}
                <WeatherWidget />

                {/* March Calculator Form */}
                <div className="bg-[#f4ebd0] border-4 border-[#3e342a] p-4 shadow-[6px_6px_0px_#3e342a] font-serif">
                  <h3 className="text-sm font-black uppercase mb-3 flex items-center gap-2">
                    <Navigation className="w-4 h-4" /> Kalkulátor přesunu (Rekrutace dat)
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="relative">
                      <label className="block text-[10px] font-bold uppercase mb-1">Vzdálenost (km)</label>
                      <input 
                        type="number" 
                        value={marchDistance}
                        onChange={(e) => setMarchDistance(e.target.value)}
                        className="w-full bg-white border-2 border-[#1a2f4c] px-2 py-1 text-sm font-black"
                      />
                      <button 
                        onClick={handleUseMapDistance}
                        className="absolute right-1 top-6 text-[#1a2f4c] hover:text-[#b8974a]"
                        title="Použít délku trasy z mapy"
                      >
                        <MapIcon className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase mb-1">Čas (minuty)</label>
                      <input 
                        type="number" 
                        value={marchMinutes}
                        onChange={(e) => setMarchMinutes(e.target.value)}
                        className="w-full bg-white border-2 border-[#1a2f4c] px-2 py-1 text-sm font-black"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleLogMarch}
                    className="w-full bg-[#1a2f4c] text-[#f4ebd0] font-black uppercase text-xs py-2 shadow-[4px_4px_0px_#8b0000] active:shadow-none translate-y-0 active:translate-y-[4px] active:translate-x-[4px] transition-all"
                  >
                    Zapsat do pochodového deníku
                  </button>
                </div>

                {/* Interactive Military Map */}
                <div className="h-[45vh] sm:h-[450px] min-h-[300px] bg-[#d1d1b8] border-4 sm:border-[12px] border-[#3e342a] shadow-lg relative overflow-hidden shrink-0">
                   <MilitaryMap otherSoldiers={globalStats as any[]} />
                </div>

                {/* Huge 3D Call to Action - Redesigned for mobile responsiveness */}
                <div className="flex flex-col items-center justify-center gap-4 sm:gap-8 pt-2 pb-6 px-2 sm:px-12 flex-1">
                  <div className="flex items-center justify-center gap-2 sm:gap-12 w-full">
                    {/* Hand-drawn Camera Icon */}
                    <motion.button 
                      whileHover={{ scale: 1.1, rotate: -5 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={startCamera}
                      className="flex flex-col items-center p-2 text-[#1a2f4c] transition-transform"
                    >
                      <svg className="w-8 h-8 sm:w-14 sm:h-14" viewBox="0 0 100 100" fill="white" stroke="#1a2f4c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 35 L80 35 L85 45 L85 85 L15 85 L15 45 Z" />
                        <circle cx="50" cy="62" r="15" fill="#f4ebd0" />
                        <rect x="40" y="25" width="20" height="10" />
                      </svg>
                      <span className="block text-[7px] sm:text-[8px] font-black mt-1 uppercase tracking-widest text-center">Foto</span>
                    </motion.button>

                    {/* Main POSLUŠNĚ HLÁSÍM Button */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.9, y: 4 }}
                      animate={isRecording ? { scale: [1, 1.05, 1], ring: [4, 12, 4] } : {}}
                      onClick={toggleRecording}
                      className={`w-36 h-36 sm:w-56 sm:h-56 rounded-full flex flex-col items-center justify-center text-center p-3 sm:p-8 transition-colors duration-300 relative group shrink-0
                        ${isRecording ? 'bg-red-700' : 'bg-[#b8974a] hover:bg-[#c9a85b]'}
                        border-4 sm:border-8 border-[#1a2f4c] shadow-[0_8px_0_#9a7e3a,0_15px_15px_rgba(0,0,0,0.1)]
                        ring-4 ${isRecording ? 'ring-red-400/50' : 'ring-white/30'} ring-offset-4 ring-offset-[#b8974a]
                      `}
                    >
                      <span className={`text-[13px] sm:text-2xl font-black uppercase tracking-tighter font-serif leading-tight relative z-10 ${isRecording ? 'text-white' : 'text-[#1a2f4c]'}`}>
                        {isRecording ? 'ZASTAVIT A ODESLAT' : 'POSLUŠNĚ HLÁSÍM'}
                      </span>
                      {isRecording && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mt-2 flex gap-1 justify-center"
                        >
                          {[0, 1, 2].map(i => (
                            <motion.div 
                              key={i}
                              animate={{ scaleY: [1, 2, 1], opacity: [0.3, 1, 0.3] }}
                              transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                              className="w-1 h-3 bg-white rounded-full"
                            />
                          ))}
                        </motion.div>
                      )}
                    </motion.button>

                    {/* Text Note Button */}
                    <motion.button 
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setIsNoteOpen(!isNoteOpen);
                        playSound('CLICK');
                      }}
                      className={`flex flex-col items-center p-2 transition-all ${isNoteOpen ? 'text-[#b8974a]' : 'text-[#1a2f4c]'}`}
                    >
                      <ScrollText className="w-8 h-8 sm:w-14 sm:h-14" />
                      <span className="block text-[7px] sm:text-[8px] font-black mt-1 uppercase tracking-widest text-center">Zápis</span>
                    </motion.button>
                  </div>

                  <AnimatePresence>
                    {isNoteOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="w-full max-w-sm overflow-hidden"
                      >
                        <div className="bg-white border-4 border-[#1a2f4c] p-4 shadow-[4px_4px_0px_#1a2f4c] mb-4">
                          {selectedImage && (
                            <div className="mb-4 relative group">
                              <img src={selectedImage} alt="Draft" className="w-full h-48 object-cover border-2 border-[#1a2f4c]" />
                              <button 
                                onClick={() => setSelectedImage(null)}
                                className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full shadow-lg"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <div className="mt-2 flex justify-center">
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={handleStylize}
                                  disabled={isStylizing}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-sm font-black text-[10px] uppercase tracking-widest transition-all
                                    ${isStylizing ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1a2f4c] text-[#f4ebd0] hover:bg-[#b8974a]'}
                                  `}
                                >
                                  {isStylizing ? (
                                    <>
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      Historizace...
                                    </>
                                  ) : (
                                    <>
                                      <History className="w-4 h-4" />
                                      AI Historizace (1914 Style)
                                    </>
                                  )}
                                </motion.button>
                              </div>
                            </div>
                          )}
                          <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={selectedImage ? "Přidejte komentář k fotografii..." : "Zde pište hlášení v písemné formě..."}
                            className="w-full bg-transparent border-none focus:ring-0 font-serif italic text-sm min-h-[80px] resize-none"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-2">
                             <button 
                               onClick={() => setIsNoteOpen(false)}
                               className="px-3 py-1 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100"
                             >
                               Zrušit
                             </button>
                             <button 
                               onClick={() => {
                                 handleSend();
                                 setIsNoteOpen(false);
                               }}
                               disabled={!inputText.trim()}
                               className="bg-[#1a2f4c] text-[#f4ebd0] px-4 py-1 text-[10px] font-black uppercase tracking-widest hover:bg-[#b8974a] transition-colors disabled:opacity-30"
                             >
                               Odeslat
                             </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="w-full max-w-sm bg-[#1a2f4c]/5 border-2 border-dashed border-[#1a2f4c]/20 p-4 sm:p-6 font-serif italic text-[11px] sm:text-sm text-center relative overflow-hidden">
                     {isRecording ? (
                       <div className="space-y-1">
                         <p className="text-[10px] font-black uppercase tracking-widest text-[#8b0000] not-italic mb-2 animate-pulse">● Vojenský odposlech aktivní...</p>
                         <p className="text-black/80">{inputText}{interimTranscript && <span className="opacity-40">{interimTranscript}</span>}</p>
                         {!inputText && !interimTranscript && <p className="opacity-40">Mluvte jasně a zřetelně, vojíne!</p>}
                       </div>
                     ) : (
                       allMessages.length > 0 
                        ? `Posl. akce: "${allMessages[allMessages.length - 1].sender === 'user' ? allMessages[allMessages.length - 1].text?.substring(0, 30) : allMessages[allMessages.length - 1].response?.shvejk_comment?.substring(0, 30)}..."`
                        : "Žádné hlášení v polní poště."
                     )}
                  </div>
                </div>

                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />

                {/* Nature & Historical Context */}
                <div className="px-2 sm:px-0">
                  <NatureAnalysis messages={allMessages} />
                </div>
              </motion.div>
            )}

            {activeTab === 'Hlášení' && (
              <motion.div 
                key="posta"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-3 sm:p-8 space-y-4"
              >
            <h2 className="text-3xl font-black uppercase tracking-tighter font-serif border-b-4 border-[#1a2f4c] pb-2 mb-8 flex items-center gap-3">
              <HistoryIcon className="w-8 h-8" /> Polní zpravodaj (Armádní sbor)
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
                    <div className="flex items-center gap-3">
                      {(msg as any).userPhoto && (
                        <img src={(msg as any).userPhoto} className="w-8 h-8 rounded-full border border-black/20" alt="Soldier" />
                      )}
                      <div>
                        <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-black/50">Soldat</p>
                        <p className="text-lg font-black uppercase">Vojín {(msg as any).userName || (msg.sender === 'user' ? (user?.displayName || 'neznámý') : 'Josef Švejk')}</p>
                      </div>
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
          </motion.div>
        )}

            {activeTab === 'Kantýna' && (
              <motion.div 
                key="kantyna"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="p-3 sm:p-8 space-y-6"
              >
                <div className="bg-[#1a2f4c] text-[#f4ebd0] p-6 border-4 border-[#b8974a] shadow-xl text-center">
                  <h3 className="text-2xl font-black uppercase mb-1">Stav zásob</h3>
                  <p className="text-xs opacity-70 italic tracking-widest">Příděly pro mužstvo</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="group relative bg-white border-2 border-[#1a2f4c] p-4 text-center shadow-[4px_4px_0px_#1a2f4c] cursor-help">
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      whileHover={{ opacity: 1, y: 0, scale: 1 }}
                      className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a2f4c] text-[#f4ebd0] p-3 text-[10px] font-black uppercase tracking-tight shadow-xl z-50 pointer-events-none border-b-4 border-[#b8974a]"
                    >
                      <div className="mb-2 border-b border-white/20 pb-1">Analýza obsahu krve</div>
                      <p className="italic font-serif normal-case opacity-80 leading-tight">
                        {stats.alcohol > 0.5 
                          ? "Při této hladině se i polní kuchyně zdá být pětihvězdičkovým hotelem v Mariánských Lázních." 
                          : "0.5 ‰ a méně? To je stav vhodný leda tak pro biskupa, ne pro řádného maršála!"}
                      </p>
                      <div className="mt-2 text-[8px] text-[#b8974a]">● Celkem vypito: {stats.alcohol} promile</div>
                    </motion.div>
                    <Beer className="w-8 h-8 mx-auto mb-2 text-[#b8974a]" />
                    <p className="text-[10px] font-black uppercase opacity-60">Lihoměr</p>
                    <p className="text-3xl font-black">{stats.alcohol} ‰</p>
                  </div>

                  <div className="group relative bg-white border-2 border-[#1a2f4c] p-4 text-center shadow-[4px_4px_0_#1a2f4c] cursor-help">
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      whileHover={{ opacity: 1, y: 0, scale: 1 }}
                      className="absolute bottom-full left-0 right-0 mb-2 bg-[#8b0000] text-[#f4ebd0] p-3 text-[10px] font-black uppercase tracking-tight shadow-xl z-50 pointer-events-none border-b-4 border-[#1a2f4c]"
                    >
                      <div className="mb-2 border-b border-white/20 pb-1">Energetická bilance</div>
                      <p className="italic font-serif normal-case opacity-80 leading-tight">
                        {stats.calories > 1500 
                          ? "S touto energií byste mohl dotlačit kanón až do Budapešti bez zastávky na pivo." 
                          : "Každých 500 kcal je jeden poctivý vídeňský řízek, který vám dodá sílu k dalšímu hlášení."}
                      </p>
                      <div className="mt-2 text-[8px] opacity-60">● Příjem z hlášení: {stats.calories} kcal</div>
                    </motion.div>
                    <Flame className="w-8 h-8 mx-auto mb-2 text-[#8b0000]" />
                    <p className="text-[10px] font-black uppercase opacity-60">Energie</p>
                    <p className="text-3xl font-black">{stats.calories} kcal</p>
                  </div>
                </div>

                {/* Alcohol Logging */}
                <div className="bg-[#fdfaf1] border-4 border-[#3e342a] p-4 shadow-[6px_6px_0px_#3e342a]">
                   <h3 className="text-xs font-black uppercase mb-4 text-center border-b-2 border-black/10 pb-2">Hlášení o proviantu</h3>
                   <div className="flex gap-4">
                      <button 
                        onClick={handleAddBeer}
                        className="flex-1 bg-white border-2 border-[#b8974a] p-3 flex flex-col items-center gap-1 hover:bg-[#b8974a]/10 transition-colors"
                      >
                         <Beer className="w-6 h-6 text-[#b8974a]" />
                         <span className="text-[10px] font-black uppercase">Dát si pivo</span>
                         <span className="text-[8px] opacity-50">+0.3‰</span>
                      </button>
                      <button 
                        onClick={handleAddRum}
                        className="flex-1 bg-white border-2 border-[#1a2f4c] p-3 flex flex-col items-center gap-1 hover:bg-[#1a2f4c]/10 transition-colors"
                      >
                         <Wine className="w-6 h-6 text-[#1a2f4c]" />
                         <span className="text-[10px] font-black uppercase">Dát si rum</span>
                         <span className="text-[8px] opacity-50">+0.2‰</span>
                      </button>
                   </div>
                </div>

                <div className="bg-[#1a2f4c]/5 p-6 border-2 border-dashed border-[#1a2f4c]/20 text-center italic mb-4">
                   <p className="text-xs sm:text-sm">
                     {stats.alcohol > 1.0 
                       ? "Mužstvo vesele zpívá rakouskou hymnu, leč kroky jsou nejisté." 
                       : "Kázeň je vzorná, leč hrdla jsou vyschlá jako saharská poušť."}
                   </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'Statistiky' && (
              <motion.div 
                key="statistiky"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-3 sm:p-8 space-y-8"
              >
                <h2 className="text-3xl font-black uppercase tracking-tighter font-serif border-b-4 border-[#1a2f4c] pb-2 mb-8 flex items-center gap-3">
                  <Trophy className="w-8 h-8" /> Hlášení generálního štábu
                </h2>

                {/* Aggregate Unit Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="bg-[#1a2f4c] text-[#f4ebd0] p-6 shadow-xl border-4 border-[#b8974a] flex flex-col items-center justify-center text-center">
                     <Flame className="w-10 h-10 mb-2 opacity-50" />
                     <p className="text-[10px] font-black uppercase tracking-[0.2em]">Společné úsilí (Kalorie)</p>
                     <p className="text-4xl font-black">{totalUnitCalories.toLocaleString()} <span className="text-xs uppercase">kcal</span></p>
                     <p className="text-[8px] italic mt-2 opacity-60">Celkový spálený tuk celého sboru</p>
                   </div>
                   <div className="bg-[#b8974a] text-[#1a2f4c] p-6 shadow-xl border-4 border-[#1a2f4c] flex flex-col items-center justify-center text-center">
                     <Beer className="w-10 h-10 mb-2 opacity-50" />
                     <p className="text-[10px] font-black uppercase tracking-[0.2em]">Bojová nálada (Průměr)</p>
                     <p className="text-4xl font-black">{avgUnitAlcohol} <span className="text-xs uppercase">‰</span></p>
                     <p className="text-[8px] italic mt-2 opacity-60">Průměrná hladina veselosti v krvi</p>
                   </div>
                </div>

                {/* Participant Table */}
                <div className="shvejk-card p-4 sm:p-8 bg-white/40">
                   <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-2 border-b border-black/10 pb-2">
                     <User className="w-5 h-5 text-[#1a2f4c]" /> Seznam vojínů v poli
                   </h3>
                   <div className="overflow-x-auto">
                     <table className="w-full text-left font-serif">
                       <thead>
                         <tr className="border-b-2 border-[#1a2f4c] text-[10px] sm:text-xs font-black uppercase tracking-widest text-black/50">
                           <th className="py-3 px-2">Pořadí</th>
                           <th className="py-3 px-2">Vojín</th>
                           <th className="py-3 px-2 text-right">Lihoměr</th>
                           <th className="py-3 px-2 text-right">Kalorie</th>
                         </tr>
                       </thead>
                       <tbody className="text-sm sm:text-base">
                         {(globalStats as any[])?.map((s, i) => (
                           <tr key={s.userId} className="border-b border-black/5 hover:bg-[#b8974a]/5 transition-colors">
                             <td className="py-4 px-2 font-black">{i + 1}.</td>
                             <td className="py-4 px-2">
                               <div className="flex items-center gap-3">
                                 {s.userPhoto ? (
                                   <img src={s.userPhoto} className="w-8 h-8 rounded-full border border-black/10" alt="" />
                                 ) : (
                                   <div className="w-8 h-8 rounded-full bg-[#1a2f4c] flex items-center justify-center text-white text-[10px]">💂</div>
                                 )}
                                 <span className="font-black uppercase text-[12px] sm:text-sm truncate max-w-[120px]">
                                   {s.userName || 'Neznámý vojín'}
                                 </span>
                               </div>
                             </td>
                             <td className="py-4 px-2 text-right font-black text-[#b8974a]">{s.currentAlcohol} ‰</td>
                             <td className="py-4 px-2 text-right font-bold opacity-70">{s.totalCalories}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                   <div className="mt-8 pt-4 border-t border-dashed border-black/10 text-center italic text-[10px] opacity-50 uppercase tracking-widest">
                     Konec hlášení hloubkové analýzy štábu
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="hidden sm:flex p-6 bg-[#1a2f4c] text-[#f4ebd0] flex-row justify-between items-center text-[10px] font-bold uppercase tracking-widest shrink-0">
        <span className="opacity-60">© 1914—2026 C.K. Informační Služba</span>
        <span className="text-[#b8974a]">Písek — Zátaví — Putim</span>
        <span className="opacity-60">Kaiser-Josef-Gasse 1, Písek</span>
      </footer>

      {/* Floating Bottom Navigation Tabs */}
      <nav className="fixed bottom-4 left-4 right-4 sm:static flex bg-[#f4ebd0] border-4 border-[#1a2f4c] z-50 shadow-2xl rounded-2xl overflow-hidden sm:rounded-none sm:border-t-0 sm:border-x-0 sm:border-b-4 sm:shadow-none sm:left-0 sm:right-0 sm:bottom-0">
        {[
          { name: 'Marš', icon: MapPin },
          { name: 'Hlášení', icon: ScrollText },
          { name: 'Kantýna', icon: Beer },
          { name: 'Statistiky', icon: Trophy }
        ].map((tab) => (
          <button
            key={tab.name}
            onClick={() => {
              setActiveTab(tab.name);
              playSound('CLICK');
            }}
            className={`flex-1 py-3 sm:py-4 flex flex-col items-center gap-1 font-black text-[9px] sm:text-[11px] uppercase tracking-wider transition-all border-r-2 border-[#1a2f4c] last:border-r-0 border-t-2 border-white/20 relative outline-1 outline-white/10 ${
              activeTab === tab.name 
                ? 'bg-[#1a2f4c] text-[#fdfaf1] ring-inset ring-2 ring-white/20' 
                : 'text-[#1a2f4c]'
            }`}
          >
            <tab.icon className={`w-4 h-4 sm:w-6 sm:h-6 ${activeTab === tab.name ? 'animate-bounce' : ''}`} />
            <span>{tab.name}</span>
          </button>
        ))}
      </nav>

      <ProfileModal 
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={profile}
        onLogout={handleLogout}
      />

      {/* Military Camera Overlay */}
      <AnimatePresence>
        {isCameraActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center"
          >
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/film-grain.png")' }}></div>
            
            {/* Viewfinder Overlay */}
            <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
              <div className="flex-1 flex justify-between p-4">
                <div className="w-8 h-8 border-t-2 border-l-2 border-[#b8974a]" />
                <div className="w-8 h-8 border-t-2 border-r-2 border-[#b8974a]" />
              </div>
              <div className="flex-1 flex justify-between p-4 items-end">
                <div className="w-8 h-8 border-b-2 border-l-2 border-[#b8974a]" />
                <div className="w-8 h-8 border-b-2 border-r-2 border-[#b8974a]" />
              </div>
            </div>

            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover grayscale-[0.2] sepia-[0.1]" 
            />

            {/* Camera Controls */}
            <div className="absolute bottom-12 left-0 right-0 z-20 flex justify-center items-center gap-12 px-8">
              <button 
                onClick={stopCamera}
                className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border-2 border-white/30 flex items-center justify-center"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              <button 
                onClick={takePhoto}
                className="w-20 h-20 rounded-full bg-white border-8 border-white/30 shadow-2xl flex items-center justify-center active:scale-90 transition-transform"
              >
                <div className="w-12 h-12 rounded-full border-2 border-[#1a2f4c]" />
              </button>

              <div className="w-12 h-12 flex items-center justify-center">
                 <p className="text-[8px] font-black uppercase text-white/50 tracking-widest text-center">Armádní<br/>fokus</p>
              </div>
            </div>

            <div className="absolute top-8 left-0 right-0 text-center z-20">
               <p className="text-[10px] font-black uppercase text-[#b8974a] tracking-[0.4em] drop-shadow-md">Polní dokumentace v.1914</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

