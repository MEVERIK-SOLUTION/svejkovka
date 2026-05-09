import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Ruler, Weight, Calendar, VenusAndMars, Save, LogOut } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { playSound } from '../lib/sounds';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  onLogout: () => void;
}

export default function ProfileModal({ isOpen, onClose, profile, onLogout }: ProfileModalProps) {
  const [height, setHeight] = useState(profile?.height || '');
  const [weight, setWeight] = useState(profile?.weight || '');
  const [age, setAge] = useState(profile?.age || '');
  const [gender, setGender] = useState(profile?.gender || 'male');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setHeight(profile.height || '');
      setWeight(profile.weight || '');
      setAge(profile.age || '');
      setGender(profile.gender || 'male');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile?.uid) return;
    setIsSaving(true);
    playSound('STAMP');
    try {
      const userDoc = doc(db, 'users', profile.uid);
      await updateDoc(userDoc, {
        height: Number(height),
        weight: Number(weight),
        age: Number(age),
        gender,
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#1a2f4c]/80 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-[#f4ebd0] border-[12px] border-[#3e342a] p-8 shadow-2xl font-serif overflow-hidden"
          >
            {/* Background Texture */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/parchment.png")' }}></div>
            
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-[#1a2f4c]/10 rounded-full transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8 border-b-4 border-[#1a2f4c] pb-4">
                <div className="w-16 h-16 rounded-full border-4 border-[#1a2f4c] overflow-hidden">
                  <img src={profile?.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">Osobní spis</h2>
                  <p className="text-xs font-bold text-[#b8974a] uppercase tracking-widest">{profile?.displayName}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1">
                      <Ruler className="w-3 h-3" /> Výška (cm)
                    </label>
                    <input 
                      id="profile-height"
                      type="number" 
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className="w-full bg-white/50 border-2 border-[#1a2f4c] p-2 font-black text-lg focus:outline-none focus:bg-white transition-colors"
                      placeholder="e.g. 180"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1">
                      <Weight className="w-3 h-3" /> Váha (kg)
                    </label>
                    <input 
                      id="profile-weight"
                      type="number" 
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="w-full bg-white/50 border-2 border-[#1a2f4c] p-2 font-black text-lg focus:outline-none focus:bg-white transition-colors"
                      placeholder="e.g. 85"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Věk
                    </label>
                    <input 
                      id="profile-age"
                      type="number" 
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="w-full bg-white/50 border-2 border-[#1a2f4c] p-2 font-black text-lg focus:outline-none focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1">
                      <VenusAndMars className="w-3 h-3" /> Pohlaví
                    </label>
                    <select 
                      id="profile-gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full bg-white/50 border-2 border-[#1a2f4c] p-2 font-black text-sm uppercase tracking-widest h-[48px] focus:outline-none focus:bg-white transition-colors cursor-pointer"
                    >
                      <option value="male">Vojín (Muž)</option>
                      <option value="female">Vojanda (Žena)</option>
                      <option value="other">Jiné</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t-2 border-dashed border-[#1a2f4c]/20 flex flex-col gap-4">
                <p className="text-[10px] italic text-center opacity-70">
                  Tyto údaje slouží jen pro upřesnění metabolismu a výpočet vlivu piva a chůze. Nikdo jiný je neuvidí, poslušně hlásím!
                </p>
                
                <div className="flex gap-4">
                  <button 
                    onClick={onLogout}
                    className="flex-1 flex items-center justify-center gap-2 border-2 border-[#8b0000] text-[#8b0000] py-3 text-xs font-black uppercase tracking-widest hover:bg-[#8b0000] hover:text-white transition-all"
                  >
                    <LogOut className="w-4 h-4" /> Opustit útvar
                  </button>
                  <button 
                    id="profile-save-button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-[2] flex items-center justify-center gap-2 bg-[#1a2f4c] text-[#f4ebd0] py-3 text-xs font-black uppercase tracking-widest hover:bg-[#b8974a] transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" /> Uložit do spisu
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
