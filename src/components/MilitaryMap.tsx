import React, { useEffect, useState, useCallback, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { Crosshair, Search, Map as MapIcon, Navigation, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

// --- Types ---

interface StaticMarkerData {
  position: google.maps.LatLngLiteral;
  title: string;
  shvejk_quote: string;
  desc: string;
  details: string;
}

// --- Components ---

function MapControl({ position, children }: { position: google.maps.ControlPosition, children: React.ReactNode }) {
  const map = useMap();
  const controlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!map || !controlRef.current) return;
    map.controls[position].push(controlRef.current);
    
    const currentRef = controlRef.current;
    return () => {
      const controls = map.controls[position];
      for (let i = 0; i < controls.getLength(); i++) {
        if (controls.getAt(i) === currentRef) {
          controls.removeAt(i);
          break;
        }
      }
    };
  }, [map, position]);

  return <div ref={controlRef}>{children}</div>;
}

function HistoricalLayer({ enabled }: { enabled: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const historicalMapType = new google.maps.ImageMapType({
      getTileUrl: (coord, zoom) => {
        const s = (Math.abs(coord.x + coord.y) % 4) + 1;
        return `https://m${s}.mapy.cz/history-m/${zoom}-${coord.x}-${coord.y}`;
      },
      tileSize: new google.maps.Size(256, 256),
      name: 'Historical',
      maxZoom: 15,
      minZoom: 5,
      opacity: 0.85
    });

    if (enabled) {
      map.overlayMapTypes.push(historicalMapType);
    } else {
      const overlayTypes = map.overlayMapTypes;
      for (let i = 0; i < overlayTypes.getLength(); i++) {
        const mt = overlayTypes.getAt(i);
        if (mt && (mt as any).name === 'Historical') {
          overlayTypes.removeAt(i);
          break;
        }
      }
    }

    return () => {
      const overlayTypes = map.overlayMapTypes;
      if (!overlayTypes) return;
      for (let i = 0; i < overlayTypes.getLength(); i++) {
        const mt = overlayTypes.getAt(i);
        if (mt && (mt as any).name === 'Historical') {
          overlayTypes.removeAt(i);
          break;
        }
      }
    };
  }, [map, enabled]);

  return null;
}

function HistoricalMapToggle({ enabled, onToggle }: { enabled: boolean, onToggle: (val: boolean) => void }) {
  return (
    <button 
      onClick={() => onToggle(!enabled)}
      className={`w-10 h-10 sm:w-12 sm:h-12 border-2 border-[#1a2f4c] flex items-center justify-center shadow-[4px_4px_0px_#1a2f4c] active:shadow-none translate-x-[-10px] translate-y-[-10px] active:translate-x-[-6px] active:translate-y-[-6px] transition-all hover:bg-white group relative ${enabled ? 'bg-[#1a2f4c] text-[#f4ebd0]' : 'bg-[#f4ebd0] text-[#1a2f4c]'}`}
      title="Historické mapy (C. a k. 2. vojenské mapování)"
    >
      <motion.div animate={{ rotate: enabled ? 360 : 0 }}>
        <MapIcon className="w-5 h-5 sm:w-6 h-6" />
      </motion.div>
      {enabled && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#b8974a] rounded-full border border-[#f4ebd0] animate-pulse" />
      )}
    </button>
  );
}

function LocateButton({ onLocate }: { onLocate: (pos: google.maps.LatLngLiteral) => void }) {
  const handleLocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => onLocate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.warn("Locate error:", err)
    );
  };

  return (
    <button 
      onClick={handleLocate}
      className="w-10 h-10 sm:w-12 sm:h-12 bg-[#f4ebd0] border-2 border-[#1a2f4c] flex items-center justify-center text-[#1a2f4c] shadow-[4px_4px_0px_#1a2f4c] active:shadow-none translate-x-[-10px] translate-y-[-10px] active:translate-x-[-6px] active:translate-y-[-6px] transition-all hover:bg-white group"
      title="Najít mou pozici"
    >
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0]
        }}
        transition={{ 
          duration: 3, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <Crosshair className="w-5 h-5 sm:w-6 h-6 group-hover:text-[#8b0000] transition-colors" />
      </motion.div>
    </button>
  );
}

function SearchBox({ onPlaceSelect }: { onPlaceSelect: (place: google.maps.places.PlaceResult) => void }) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const placesLib = useMapsLibrary('places');

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: ['geometry', 'formatted_address', 'name'],
      types: ['address', 'geocode']
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        onPlaceSelect(place);
        setInputValue(place.formatted_address || place.name || '');
      }
    });

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const input = (e.target as HTMLInputElement).value;
        const coords = input.split(',').map(s => parseFloat(s.trim()));
        if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
          onPlaceSelect({
            geometry: { 
              location: new google.maps.LatLng(coords[0], coords[1]) 
            } as any,
            name: 'Zadané souřadnice'
          });
        }
      }
    };

    const currentInput = inputRef.current;
    currentInput.addEventListener('keydown', handleKeydown);
    return () => currentInput.removeEventListener('keydown', handleKeydown);
  }, [placesLib, onPlaceSelect]);

  return (
    <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-[1001] w-[calc(100%-16px)] sm:w-80">
      <div className="relative group">
        <input 
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Hledat adresu nebo GPS..."
          className="w-full bg-[#f4ebd0] border-2 border-[#1a2f4c] p-2 sm:p-3 pl-10 font-serif text-xs sm:text-sm italic shadow-[4px_4px_0px_#1a2f4c] sm:shadow-[6px_6px_0px_#1a2f4c] focus:outline-none focus:bg-white transition-all"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1a2f4c] opacity-60" />
      </div>
      <div className="mt-1 sm:mt-2 bg-[#1a2f4c] text-white text-[7px] sm:text-[9px] font-black uppercase px-2 py-0.5 sm:py-1 tracking-tighter shadow-md inline-block">
        Vojenská topografická služba
      </div>
    </div>
  );
}

function RoutePlanner({ origin, target }: { origin: google.maps.LatLngLiteral | null, target: google.maps.LatLngLiteral | null }) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const [routeInfo, setRouteInfo] = useState<{distance: string, duration: string} | null>(null);

  useEffect(() => {
    if (!routesLib || !map || !origin || !target) {
      polylinesRef.current.forEach(p => p.setMap(null));
      setRouteInfo(null);
      return;
    }

    polylinesRef.current.forEach(p => p.setMap(null));

    routesLib.Route.computeRoutes({
      origin: { location: { lat: origin.lat, lng: origin.lng } },
      destination: { location: { lat: target.lat, lng: target.lng } },
      travelMode: 'WALKING' as any, // Using 'WALKING' but cast to any if needed to avoid enum issues
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    }).then(({ routes }) => {
      if (routes?.[0]) {
        const newPolylines = routes[0].createPolylines();
        newPolylines.forEach(polyline => {
          polyline.setOptions({
            strokeColor: '#8b0000',
            strokeWeight: 5,
            strokeOpacity: 0.8,
            icons: [{
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 4 },
              offset: '0',
              repeat: '20px'
            }]
          });
          polyline.setMap(map);
        });
        polylinesRef.current = newPolylines;

        if (routes[0].viewport) {
          map.fitBounds(routes[0].viewport);
        }

        const distance = (Number(routes[0].distanceMeters || 0) / 1000).toFixed(1);
        const duration = Math.round(Number(routes[0].durationMillis || 0) / 60000 / 60);
        setRouteInfo({ distance: `${distance} km`, duration: `${duration} hod` });
      }
    });

    return () => polylinesRef.current.forEach(p => p.setMap(null));
  }, [routesLib, map, origin, target]);

  if (!routeInfo) return null;

  return (
    <div className="absolute top-20 right-4 z-[1001] bg-[#1a2f4c] text-[#f4ebd0] p-3 font-serif border-2 border-[#b8974a] shadow-lg max-w-[150px]">
      <p className="text-[10px] font-black uppercase border-b border-[#f4ebd0]/20 mb-2 pb-1 flex items-center gap-2">
        <Navigation className="w-3 h-3" /> Plán pochodu
      </p>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-[9px] uppercase opacity-60">Trasa</span>
          <span className="text-xs font-bold">{routeInfo.distance}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[9px] uppercase opacity-60">Čas</span>
          <span className="text-xs font-bold">{routeInfo.duration}</span>
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

const routePositions: google.maps.LatLngLiteral[] = [
  { lat: 49.3088, lng: 14.1475 }, 
  { lat: 49.2941, lng: 14.1264 }, 
  { lat: 49.2783, lng: 14.1206 }, 
];

const staticMarkers: StaticMarkerData[] = [
  { 
    position: routePositions[0], 
    title: 'Královské město Písek', 
    shvejk_quote: 'V Písku prý kdysi v hospodě "U Černého orla" čepovali tak silné pivo, že se z něj opil i rakouský orel na vývěsním štítě.',
    desc: 'Počátek anabáze. Zde se Švejk setkal s přísným, leč spravedlivým četnickým strážmistrem.',
    details: 'Historická bašta na Otavě. Doporučeno doplnit zásoby tabáku a vyhnout se provokacím místních civilistů.'
  },
  { 
    position: routePositions[1], 
    title: 'Obec Zátaví', 
    shvejk_quote: 'To je jako když tenkrát v Zátaví jeden voják zapomněl, kam vlastně mašíruje, tak se radši usadil u mostu a čekal, až půjde někdo kolem, kdo mu to připomene.',
    desc: 'Strategický bod u mostu přes Otavu. Ideální místo pro krátký odpočinek a kontrolu proviantu.',
    details: 'Soutok Blanice a Otavy je na dohled. Zátavský most je kritický komunikační uzel trasy.'
  },
  { 
    position: routePositions[2], 
    title: 'Slavná Putim', 
    shvejk_quote: 'Putim je středem světa, aspoň pro ty, co tam dorazí hladoví a žízniví. A ta strážnice? To je hotový palác, když vás tam pozvou na teplou polévku!',
    desc: 'Cíl cesty. Místo, kde se psaly dějiny Švejkovy anabáze. Pozor na rybník a místní četnictvo!',
    details: 'Konečná stanice. Očekávejte vřelé přijetí (pokud nejste podezřelý špión) a studené pivo u "Zastávky".'
  },
];

const MarkerWithInfo: React.FC<{ m: StaticMarkerData }> = ({ m }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <AdvancedMarker 
        ref={markerRef} 
        position={m.position} 
        onClick={() => setIsOpen(true)}
      >
        <Pin background="#1a2f4c" borderColor="#f4ebd0" glyphColor="#f4ebd0" />
      </AdvancedMarker>
      {isOpen && (
        <InfoWindow anchor={marker} onCloseClick={() => setIsOpen(false)}>
          <div className="font-serif p-1 max-w-[200px]">
            <p className="font-black uppercase border-b-2 border-[#1a2f4c] mb-2 text-[#1a2f4c] text-sm">{m.title}</p>
            <p className="text-[13px] italic leading-snug mb-3 text-black/80">"{m.shvejk_quote}"</p>
            <p className="text-[9px] mb-2 opacity-70 font-bold uppercase tracking-wider leading-none">{m.desc}</p>
            <div className="pt-2 border-t border-dashed border-[#1a2f4c]/20">
              <p className="text-[10px] text-[#1a2f4c] font-medium leading-tight">
                <span className="font-black">ROZKAZ:</span> {m.details}
              </p>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export default function MilitaryMap() {
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(routePositions[1]);
  const [userPos, setUserPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [targetPos, setTargetPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [isHistoricalEnabled, setIsHistoricalEnabled] = useState(false);

  if (!hasValidKey) {
    return (
      <div className="w-full h-full bg-[#3e342a]/10 flex items-center justify-center font-serif text-center p-8 border-4 border-dashed border-[#3e342a]/40">
        <div className="max-w-md bg-[#f4ebd0] p-10 border-4 border-[#1a2f4c] shadow-[15px_15px_0px_#1a2f4c]">
          <MapIcon className="w-16 h-16 mx-auto mb-6 text-[#1a2f4c]" />
          <h2 className="text-2xl font-black uppercase mb-4 text-[#1a2f4c]">Naleziště map nenalezeno</h2>
          <p className="mb-6 italic text-sm">"Bez mapy, vojáku, jste jako ten jeden desátník z mého pluku, co chtěl dobýt Itálii a skončil v Klatovech."</p>
          <div className="bg-[#1a2f4c] text-white p-4 text-xs font-bold uppercase tracking-widest leading-relaxed">
            Prosím, přidejte svůj Google Maps API klíč jako secret `GOOGLE_MAPS_PLATFORM_KEY` v nastavení aplikace.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative border-4 border-[#3e342a] shadow-inner overflow-hidden military-map-container">
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={mapCenter}
          center={mapCenter}
          defaultZoom={12}
          mapId="MILITARY_MAP_001"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          className="w-full h-full"
          disableDefaultUI={true}
          onClick={(e) => {
            if (e.detail.latLng) {
              setTargetPos(e.detail.latLng);
            }
          }}
        >
          <SearchBox onPlaceSelect={(place) => {
            if (place.geometry?.location) {
              const pos = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
              setMapCenter(pos);
              setTargetPos(pos);
            }
          }} />

          <HistoricalLayer enabled={isHistoricalEnabled} />

          <RoutePlanner origin={userPos} target={targetPos} />

          <MapControl position={google.maps.ControlPosition.RIGHT_BOTTOM}>
            <div className="flex flex-col gap-4">
              <HistoricalMapToggle 
                enabled={isHistoricalEnabled} 
                onToggle={setIsHistoricalEnabled} 
              />
              <LocateButton onLocate={(pos) => {
                setUserPos(pos);
                setMapCenter(pos);
              }} />
            </div>
          </MapControl>

          {staticMarkers.map((m, i) => (
            <MarkerWithInfo key={`static-${i}`} m={m} />
          ))}

          {userPos && (
             <AdvancedMarker position={userPos}>
                <div className="relative w-8 h-8">
                  <div className="absolute inset-0 bg-[#1a2f4c] rounded-full border-2 border-[#f4ebd0] animate-pulse"></div>
                  <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 bg-[#1a2f4c] text-[#f4ebd0] text-[8px] font-black px-1 rounded uppercase">VY</div>
                </div>
             </AdvancedMarker>
          )}

          {targetPos && (
            <AdvancedMarker position={targetPos}>
              <Pin background="#b8974a" glyph="?" />
            </AdvancedMarker>
          )}
        </Map>
      </APIProvider>

      {targetPos && (
        <div className="absolute bottom-20 left-4 z-[1001] bg-white/80 border border-[#1a2f4c] p-2 text-[10px] font-mono">
          CÍL: {targetPos.lat.toFixed(5)}, {targetPos.lng.toFixed(5)}
        </div>
      )}

      <AnimatePresence>
        {isHistoricalEnabled && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute bottom-24 right-4 z-[1001] bg-[#1a2f4c]/90 text-[#f4ebd0] px-3 py-1 text-[8px] font-black uppercase tracking-[0.2em] border border-[#b8974a] shadow-xl"
          >
            Aktivní: 2. vojenské mapování (1836–1852)
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 pointer-events-none z-[1000] border-[10px] border-[#3e342a]/30 shadow-[inset_0_0_100px_rgba(0,0,0,0.4)]">
        {/* Animated Corner Stars */}
        {[
          { top: '15px', left: '15px' },
          { top: '15px', right: '15px' },
          { bottom: '15px', left: '15px' },
          { bottom: '15px', right: '15px' }
        ].map((pos, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute text-[#b8974a] opacity-40"
            style={pos}
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
              rotate: [0, 90, 180, 270, 360]
            }}
            transition={{ 
              duration: 8 + (i * 2), 
              repeat: Infinity,
              ease: "linear"
            }}
          >
            <Star className="w-4 h-4 fill-current" />
          </motion.div>
        ))}
      </div>
      
      <div className="absolute top-4 right-4 z-[1001] bg-[#1a2f4c] text-white px-2 py-1 text-[8px] font-black uppercase tracking-widest rotate-2 shadow-md flex items-center gap-1">
        <motion.div
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Star className="w-2 h-2 fill-[#b8974a] text-[#b8974a]" />
        </motion.div>
        TOPOGRAPHISCHE MAPPE 1:10.000 (GMP)
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .military-map-container {
          filter: sepia(0.3) contrast(1.1) brightness(1);
        }
        .gm-style-iw {
          background-color: #f4ebd0 !important;
          border: 2px solid #1a2f4c !important;
          border-radius: 0 !important;
          padding: 0 !important;
        }
        .gm-style-iw-tc::after {
          background-color: #f4ebd0 !important;
        }
      `}} />
    </div>
  );
}
