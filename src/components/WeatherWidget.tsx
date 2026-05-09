import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Cloud, Sun, CloudRain, Wind, Thermometer, MapPin } from 'lucide-react';

interface WeatherData {
  temp: number;
  condition: string;
  windSpeed: number;
  location: string;
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated API call - In production, replace with real OpenWeatherMap call
    // Coordinates for Písek: 49.3088, 14.1475
    const fetchWeather = async () => {
      try {
        // Example URL: `https://api.openweathermap.org/data/2.5/weather?lat=49.3088&lon=14.1475&appid=YOUR_API_KEY&units=metric`
        
        // Simulating delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock data that looks real
        const mockData: WeatherData = {
          temp: 14,
          condition: 'Oblačno',
          windSpeed: 5.2,
          location: 'Písek'
        };
        
        setWeather(mockData);
      } catch (err) {
        console.error("Weather fetch failed", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, []);

  const getWeatherIcon = (condition: string) => {
    switch (condition.toLowerCase()) {
      case 'jasno': return <Sun className="w-8 h-8 text-[#b8974a]" />;
      case 'déšť': return <CloudRain className="w-8 h-8 text-[#1a2f4c]" />;
      case 'vítr': return <Wind className="w-8 h-8 text-[#1a2f4c]" />;
      default: return <Cloud className="w-8 h-8 text-[#1a2f4c]/60" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-[#fdfaf1]/80 border-2 border-[#1a2f4c]/20 p-4 animate-pulse flex items-center justify-center gap-4 h-24">
        <div className="w-8 h-8 bg-black/10 rounded-full" />
        <div className="h-4 w-24 bg-black/10" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-[#fdfaf1] border-4 border-[#3e342a] p-3 sm:p-4 shadow-[6px_6px_0px_#3e342a] font-serif relative overflow-hidden flex items-center gap-4 sm:gap-6"
    >
      {/* Texture */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/parchment.png")' }}></div>
      
      <div className="relative z-10 bg-[#1a2f4c] p-2 sm:p-3 text-[#fdfaf1] shadow-inner">
        {weather ? getWeatherIcon(weather.condition) : <Cloud />}
      </div>

      <div className="relative z-10 flex-1">
        <div className="flex items-center gap-1 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-[#8b0000] mb-0.5">
          <MapPin className="w-2 h-2" />
          <span>Meteorologická stanice {weather?.location}</span>
        </div>
        
        <div className="flex items-end gap-2">
          <span className="text-2xl sm:text-3xl font-black tracking-tighter leading-none">{weather?.temp}°C</span>
          <span className="text-[10px] sm:text-xs font-bold uppercase italic opacity-60 mb-1">{weather?.condition}</span>
        </div>
      </div>

      <div className="relative z-10 hidden sm:flex flex-col items-end border-l border-black/10 pl-4">
        <div className="flex items-center gap-1">
          <Wind className="w-3 h-3 opacity-40" />
          <span className="text-[10px] font-bold uppercase">{weather?.windSpeed} m/s</span>
        </div>
        <div className="flex items-center gap-1 leading-none mt-1">
           <Thermometer className="w-3 h-3 opacity-40" />
           <span className="text-[8px] font-black uppercase tracking-tighter">Bojová teplota</span>
        </div>
      </div>

      {/* Military Stamp */}
      <div className="absolute top-1 right-1 opacity-10 pointer-events-none select-none">
         <div className="border-2 border-[#8b0000] rounded-sm p-0.5 text-[6px] font-black uppercase rotate-[-15deg]">
           Geprüft
         </div>
      </div>
    </motion.div>
  );
}
