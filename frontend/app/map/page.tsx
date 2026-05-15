'use client';

import React, { useState, useEffect } from 'react';
// @ts-ignore
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { usePlayer } from '@/context/PlayerContext';
import { geoCentroid } from 'd3-geo';

const geoUrl = "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/russia.geojson";

const mapColors = [
  "#9FA8DA", // Indigo 200
  "#90CAF9", // Blue 200
  "#81D4FA", // Light Blue 200
  "#80DEEA", // Cyan 200
  "#80CBC4", // Teal 200
  "#A5D6A7", // Green 200
  "#C5E1A5", // Light Green 200
  "#E6EE9C", // Lime 200
  "#FFF59D", // Yellow 200
  "#FFE082", // Amber 200
  "#FFCC80", // Orange 200
  "#FFAB91", // Deep Orange 200
  "#F48FB1", // Pink 200
  "#CE93D8", // Purple 200
  "#B39DDB", // Deep Purple 200
];

// Helper to reliably map a string to an index
const getColorForRegion = (name: string) => {
  if (!name) return mapColors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return mapColors[Math.abs(hash) % mapColors.length];
};

const REGION_FIELDS = [
  { key: 'geography', title: 'География и этнография' },
  { key: 'roots', title: 'Древние музыкальные корни' },
  { key: 'school', title: 'Региональная школа пения' },
  { key: 'genres', title: 'Типичные жанры музыки' },
  { key: 'instruments', title: 'Традиционные инструменты' },
  { key: 'spiritualCenters', title: 'Центры духовной музыки' },
  { key: 'composers', title: 'Выдающиеся композиторы' },
  { key: 'performers', title: 'Знаменитые исполнители' },
  { key: 'expeditions', title: 'Фольклорные экспедиции' },
  { key: 'preservation', title: 'Сохранение фольклора' },
  { key: 'modern', title: 'Современная музыкальная жизнь' },
  { key: 'unique', title: 'Уникальные явления' },
  { key: 'influence', title: 'Влияние соседних культур' },
  { key: 'heritage', title: 'Музыкальные памятники' },
  { key: 'projects', title: 'Современные проекты' },
];

type RegionMeta = { id: string; name: string; slug: string; type?: string };

export default function MapPage() {
  const [selectedRegion, setSelectedRegion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState({ coordinates: [95, 62], zoom: 1 });
  const [isAnimating, setIsAnimating] = useState(false);
  const { playTrack } = usePlayer();

  const [regionsData, setRegionsData] = useState<RegionMeta[]>([]);
  const [mapScale, setMapScale] = useState(520);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMapScale(window.innerWidth >= 768 ? 750 : 550);
      const handleResize = () => setMapScale(window.innerWidth >= 768 ? 750 : 550);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Подгружаем реальный список регионов из БД (для подсветки/поиска по имени).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/map/regions');
        const json = await res.json();
        if (!cancelled && json?.success && Array.isArray(json.data)) {
          setRegionsData(
            json.data.map((r: any) => ({
              id: r.id,
              name: r.name,
              slug: r.slug,
              type: r.type,
            }))
          );
        }
      } catch (e) {
        console.error('[map] failed to load regions list', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRegionClick = async (regionConfig: any) => {
    setIsAnimating(true);
    if (regionConfig.coordinates) {
      setPosition({ coordinates: regionConfig.coordinates, zoom: 3 });
    }
    setTimeout(() => setIsAnimating(false), 700);

    // Бэк ищет по slug → name → fuzzy contains, поэтому передаём name из geojson.
    const key = encodeURIComponent(regionConfig.slug || regionConfig.name);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`/api/map/regions/${key}`, { headers });
      const json = await response.json();

      if (json.success) {
        setSelectedRegion(json.data);
      } else {
        setSelectedRegion({
          ...regionConfig,
          historicalData: null,
        });
      }
    } catch (e) {
      console.error(e);
      setSelectedRegion({ ...regionConfig, historicalData: null });
    }
  };

  return (
    <main className="absolute inset-0 pt-[140px] md:pt-[100px] pb-[100px] md:pb-[140px] px-0 md:px-6 w-full flex flex-col overflow-hidden z-0">

      {/* Заголовок страницы (Вне карты) */}
      <div className="shrink-0 mb-4 md:mb-6 px-6 md:px-0 z-10 w-full relative">
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mb-1 text-[var(--text-primary)]">Музыкальная карта</h1>
        <p className="text-[var(--text-secondary)]">Исследуйте традиции по регионам России</p>
      </div>

      {/* Контейнер для карты и сайдбара */}
      <div className="flex-grow flex flex-col md:flex-row min-h-0 relative w-full">

        {/* Главная часть: Карта */}
        <div className="flex-grow relative flex items-center justify-center">

        {loading ? (
          <div className="w-full h-full flex items-center justify-center text-[var(--text-secondary)]">Загрузка карты...</div>
        ) : (
          <div
            className={`w-full h-full absolute inset-0 pt-20 flex items-center justify-center px-0 ${isAnimating ? '[&_g]:transition-transform [&_g]:duration-700 [&_g]:ease-in-out' : ''}`}
            style={{ touchAction: 'none' }}
          >
            <ComposableMap
              projection="geoAzimuthalEqualArea"
              projectionConfig={{
                rotate: mapScale >= 750 ? [-95, -66, 0] : [-95, -64, 0],
                scale: mapScale
              }}
              style={{ width: "100%", height: "100%", outline: "none", overflow: "visible" }}
            >
              <ZoomableGroup
                zoom={position.zoom}
                center={position.coordinates as [number, number]}
                onMoveEnd={(pos) => setPosition(pos as any)}
              >
                <Geographies geography={geoUrl}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const geoName = geo.properties.name || geo.properties.NAME_1 || geo.properties.name_ru || "";
                      const baseColor = getColorForRegion(geoName);

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onClick={() => {
                            const centroid = geoCentroid(geo);
                            // Сначала точное совпадение, потом подстрока
                            // ("Татарстан" в geojson ↔ "Республика Татарстан" в БД).
                            const match =
                              regionsData.find(r => r.name === geoName) ||
                              regionsData.find(
                                r =>
                                  r.name.toLowerCase().includes(geoName.toLowerCase()) ||
                                  geoName.toLowerCase().includes(r.name.toLowerCase())
                              );

                            const config = match
                              ? { ...match, coordinates: centroid as [number, number] }
                              : {
                                  name: geoName,
                                  slug: undefined,
                                  type: 'Регион',
                                  coordinates: centroid as [number, number],
                                };

                            handleRegionClick(config);
                          }}
                          className="focus:outline-none outline-none cursor-pointer"
                          style={{
                            default: {
                              fill: selectedRegion && selectedRegion.name === geoName ? "var(--accent)" : baseColor,
                              stroke: "#FFFFFF",
                              strokeWidth: 0.5
                            },
                            hover: { fill: "#B8C9E1", stroke: "#FFFFFF", strokeWidth: 0.5 },
                            pressed: { fill: "#A0B5D6", stroke: "#FFFFFF", strokeWidth: 0.5 },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>

                {/* Additional Crimea and Sevastopol geometries */}
                <Geographies geography="https://raw.githubusercontent.com/slawomirmatuszak/ukrainian_geodata/master/regiony.geojson">
                  {({ geographies }) =>
                    geographies
                      .filter(geo => geo.properties.region === 'Автономна Республіка Крим' || geo.properties.region === 'Севастополь')
                      .map((geo) => {
                        const geoName = geo.properties.region === 'Автономна Республіка Крим' ? 'Республика Крым' : 'Севастополь';
                        const customGeo = { ...geo, properties: { ...geo.properties, name: geoName } };
                        const baseColor = getColorForRegion(geoName);

                        return (
                          <Geography
                            key={customGeo.rsmKey}
                            geography={customGeo}
                            onClick={() => {
                              const centroid = geoCentroid(customGeo);
                              const match =
                                regionsData.find(r => r.name === geoName) ||
                                regionsData.find(
                                  r =>
                                    r.name.toLowerCase().includes(geoName.toLowerCase()) ||
                                    geoName.toLowerCase().includes(r.name.toLowerCase())
                                );
                              const config = match
                                ? { ...match, coordinates: centroid as [number, number] }
                                : {
                                    name: geoName,
                                    slug: undefined,
                                    type: 'Регион',
                                    coordinates: centroid as [number, number],
                                  };
                              handleRegionClick(config);
                            }}
                            className="focus:outline-none outline-none cursor-pointer"
                            style={{
                              default: {
                                fill: selectedRegion && selectedRegion.name === geoName ? "var(--accent)" : baseColor,
                                stroke: "#FFFFFF",
                                strokeWidth: 0.5
                              },
                              hover: { fill: "#B8C9E1", stroke: "#FFFFFF", strokeWidth: 0.5 },
                              pressed: { fill: "#A0B5D6", stroke: "#FFFFFF", strokeWidth: 0.5 },
                            }}
                          />
                        );
                      })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
          </div>
        )}
      </div>

      {/* Сайдбар (Историческая справка и треки) */}
      <div
        className={`
          fixed bottom-0 left-0 w-full h-[65vh] z-[100]
          md:relative md:w-[400px] lg:w-[450px] md:h-full md:z-20 md:bottom-auto md:left-auto md:ml-4
          bg-[var(--surface)] border border-[var(--border)] shadow-[0_-15px_40px_rgba(0,0,0,0.1)] md:shadow-xl flex flex-col transition-transform duration-500
          rounded-t-3xl md:rounded-3xl
          ${selectedRegion ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-0 opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto'}
        `}
      >
        {/* Ручка (drag pill) для мобильных */}
        <div className="w-full flex justify-center pt-4 pb-2 md:hidden cursor-pointer" onClick={() => setSelectedRegion(null)}>
          <div className="w-12 h-1.5 bg-[var(--border)] dark:bg-[#3A3A3C] rounded-full opacity-80"></div>
        </div>

        {selectedRegion ? (
          <div className="h-full overflow-y-auto w-full p-6 md:p-8 flex flex-col custom-scrollbar">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-xs font-semibold tracking-wider text-[var(--accent)] uppercase mb-1 md:mb-2 block">
                  {selectedRegion.type}
                </span>
                <h2 className="text-2xl md:text-3xl font-bold">{selectedRegion.name}</h2>
                {selectedRegion.historicalData?.summary && (
                  <p className="mt-3 text-[var(--text-secondary)] text-sm leading-relaxed">
                    {selectedRegion.historicalData.summary}
                  </p>
                )}
              </div>
              <button
                className="apple-button-secondary px-3 py-1 text-sm md:hidden hidden"
                onClick={() => {
                  setSelectedRegion(null);
                  setIsAnimating(true);
                  setPosition({ coordinates: [95, 62], zoom: 1 });
                  setTimeout(() => setIsAnimating(false), 700);
                }}
              >
                Закрыть
              </button>
            </div>

            <div className="flex flex-col gap-4 text-[var(--text-secondary)] text-sm leading-relaxed pb-8">
              {/* 15 структурированных полей по ТЗ КАРТА.docx */}
              {REGION_FIELDS.map(field => {
                const content = selectedRegion.historicalData?.[field.key];
                if (!content) return null;
                return (
                  <section key={field.key} className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 md:p-5 border border-[var(--border)] shadow-sm">
                    <h3 className="text-[15px] font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> {field.title}
                    </h3>
                    <p className="opacity-90 whitespace-pre-line">{content}</p>
                  </section>
                );
              })}

              {/* Если структурированных полей нет, но есть shortDescription */}
              {(!REGION_FIELDS.some(f => selectedRegion.historicalData?.[f.key])) && selectedRegion.historicalData?.shortDescription && (
                <section className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 md:p-5 border border-[var(--border)] shadow-sm">
                  <h3 className="text-[15px] font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> Историческая справка
                  </h3>
                  <p className="opacity-90 whitespace-pre-line">{selectedRegion.historicalData.shortDescription}</p>
                </section>
              )}

              {/* Если данных вообще нет */}
              {!selectedRegion.historicalData && (
                <div className="bg-black/5 dark:bg-white/5 p-4 rounded-2xl italic text-sm text-center">
                  Историческая справка по этому региону скоро появится.
                </div>
              )}

              {/* Источник */}
              {selectedRegion.historicalData?.source && (
                <p className="text-xs text-[var(--text-secondary)] italic opacity-70 px-1">
                  Источник: {selectedRegion.historicalData.source}
                </p>
              )}
            </div>

            {/* Авторы региона */}
            {selectedRegion.artists && selectedRegion.artists.length > 0 && (
              <div className="mb-8">
                <h3 className="font-semibold text-lg mb-4">Авторы региона</h3>
                <div className="flex flex-wrap gap-3">
                  {selectedRegion.artists.map((artist: any) => (
                    <a
                      key={artist.id}
                      href={`/artist/${artist.slug || artist.id}`}
                      className="px-4 py-2 border border-[var(--border)] rounded-full text-sm font-medium hover:bg-[var(--hover)] transition-colors"
                    >
                      {artist.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Музыка региона */}
            {selectedRegion.tracks && (
              <div className="flex-grow">
                <h3 className="font-semibold text-lg mb-4">Музыка региона</h3>
                <div className="flex flex-col gap-2">
                  {selectedRegion.tracks.map((track: any) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-[var(--hover)] cursor-pointer group"
                      onClick={() => playTrack(track)}
                    >
                      <div className="w-10 h-10 bg-[var(--border)] rounded-md shrink-0 flex items-center justify-center font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                        ▶
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="font-medium text-[var(--text-primary)] truncate text-sm">{track.title}</h4>
                        <p className="text-xs text-[var(--text-secondary)] truncate">{track.artist?.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full hidden md:flex flex-col items-center justify-center p-8 text-center text-[var(--text-secondary)]">
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2 mt-4">Музыкальные регионы</h3>
            <p className="text-sm leading-relaxed">
              Нажмите на любую подсвеченную область на карте, чтобы узнать о ее аутентичных традициях, фольклоре и послушать местные записи.
            </p>
          </div>
        )}
      </div>

      </div> {/* Конец контейнера контента */}

    </main>
  );
}
