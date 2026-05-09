
const SOUNDS = {
  CLICK: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  SEND: 'https://assets.mixkit.co/active_storage/sfx/1486/1486-preview.mp3',
  RECEIVE: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
  STAMP: 'https://assets.mixkit.co/active_storage/sfx/1317/1317-preview.mp3',
  RECORDING: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3', // Ticking sound
  SUCCESS: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3', // Ta-da/Success
};

let isMuted = false;
let activeLoops: Partial<Record<keyof typeof SOUNDS, HTMLAudioElement>> = {};

export const setMuted = (muted: boolean) => {
  isMuted = muted;
  if (muted) {
    // Stop all active loops if muted
    Object.keys(activeLoops).forEach((key) => {
      stopSound(key as keyof typeof SOUNDS);
    });
  }
};

export const getMuted = () => isMuted;

export const playSound = (soundKey: keyof typeof SOUNDS, loop = false) => {
  if (isMuted) return;
  if (loop && activeLoops[soundKey]) return; // Already playing

  const audio = new Audio(SOUNDS[soundKey]);
  audio.volume = 0.5;
  audio.loop = loop;
  
  if (loop) {
    activeLoops[soundKey] = audio;
  }

  audio.play().catch(err => console.log('Sound play blocked:', err));
};

export const stopSound = (soundKey: keyof typeof SOUNDS) => {
  const audio = activeLoops[soundKey];
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    delete activeLoops[soundKey];
  }
};
