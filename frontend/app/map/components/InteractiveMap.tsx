'use client';

import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { geoCentroid } from 'd3-geo';
import { getRegionData, RegionData } from '../data/regionsData';

const geoUrl = "https://raw.githubusercontent.com/logvik/d3_russian_map/master/map_assets/russia_mercator.json";

interface InteractiveMapProps {
  selectedRegion: RegionData | null;
  onRegionSelect: (region: RegionData) => void;
  hoveredRegion: string | null;
  onRegionHover: (regionName: string | null) => void;
}

// Мемоизированный компонент для одного региона
const RegionGeography = memo(({ 
  geo, 
  regionData, 
  isSelected,
  onClick,
  onMouseEnter,
  onMouseLeave 
}: any) => {
  return (
    <Geography
      geography={geo}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="geography-path"
      style={{
        default: {
          fill: regionData.color,
          stroke: isSelected ? '#fbbf24' : '#ffffff',
          strokeWidth: isSelected ? 1.5 : 0.5,
          strokeLinejoin: 'round',
          strokeLinecap: 'round',
          opacity: 0.85,
          vectorEffect: 'non-scaling-stroke'
        },
        hover: {
          fill: regionData.color,
          stroke: '#ffffff',
          strokeWidth: 0.5,
          opacity: 0.85,
          vectorEffect: 'non-scaling-stroke'
        },
        pressed: {
          fill: regionData.color,
          stroke: '#fbbf24',
          strokeWidth: 1.5,
          opacity: 0.85,
          vectorEffect: 'non-scaling-stroke'
        }
      }}
    />
  );
}, (prevProps, nextProps) => {
  // Перерендерить только если изменился статус выбора
  return prevProps.isSelected === nextProps.isSelected &&
         prevProps.geo.rsmKey === nextProps.geo.rsmKey;
});

RegionGeography.displayName = 'RegionGeography';

export default function InteractiveMap({ 
  selectedRegion, 
  onRegionSelect,
  hoveredRegion,
  onRegionHover
}: InteractiveMapProps) {
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([95, 63]);
  const [loadedGeographies, setLoadedGeographies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentPositionRef = useRef<{ center: [number, number]; zoom: number }>({
    center: [95, 63],
    zoom: 1,
  });

  const animationFrameRef = useRef<number | null>(null);
  const isUserZoomedRef = useRef<boolean>(false);
  const isAnimatingRef = useRef<boolean>(false);
  
  // Кэш для regionData, чтобы не пересчитывать каждый раз
  const regionDataCache = useRef<Map<string, RegionData>>(new Map());

  useEffect(() => {
    setIsLoading(true);
    fetch(geoUrl)
      .then(res => res.json())
      .then(data => {
        let features;
        if (data.type === 'Topology' && data.objects) {
          const topojson = require('topojson-client');
          const objectKey = Object.keys(data.objects)[0];
          const geoData = topojson.feature(data, data.objects[objectKey]);
          features = geoData.features;
        } else if (data.type === 'FeatureCollection') {
          features = data.features;
        }
        
        setLoadedGeographies(features || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Ошибка загрузки GeoJSON:', err);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const getCachedRegionData = useCallback((properties: any): RegionData => {
    const key = properties.ISO_2 || properties.name || properties.NAME;
    
    if (!regionDataCache.current.has(key)) {
      regionDataCache.current.set(key, getRegionData(properties));
    }
    
    return regionDataCache.current.get(key)!;
  }, []);

  const getRegionCenter = useCallback((geo: any): [number, number] => {
    try {
      const centroid = geoCentroid(geo);
      return [centroid[0], centroid[1]];
    } catch (error) {
      return [95, 63];
    }
  }, []);

  const easeInOutCubic = useCallback((t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }, []);

  const animateTransition = useCallback((
    targetCenter: [number, number],
    targetZoom: number,
    duration: number = 800
  ) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    isAnimatingRef.current = true;
    
    const startCenter = currentPositionRef.current.center;
    const startZoom = currentPositionRef.current.zoom;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      const newCenter: [number, number] = [
        startCenter[0] + (targetCenter[0] - startCenter[0]) * easedProgress,
        startCenter[1] + (targetCenter[1] - startCenter[1]) * easedProgress,
      ];
      const newZoom = startZoom + (targetZoom - startZoom) * easedProgress;

      currentPositionRef.current = { center: newCenter, zoom: newZoom };
      setCenter(newCenter);
      setZoom(newZoom);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
        isAnimatingRef.current = false;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [easeInOutCubic]);

  const handleRegionClick = useCallback((geo: any, regionData: RegionData) => {
    onRegionSelect(regionData);
    
    const regionCenter = getRegionCenter(geo);
    const currentZoom = currentPositionRef.current.zoom;
    const targetZoom = Math.max(currentZoom, 2.5);
    
    animateTransition(regionCenter, targetZoom, 900);
  }, [onRegionSelect, getRegionCenter, animateTransition]);

  const handleZoomIn = useCallback(() => {
    isUserZoomedRef.current = true;
    const newZoom = Math.min(currentPositionRef.current.zoom + 0.5, 8);
    animateTransition(currentPositionRef.current.center, newZoom, 400);
  }, [animateTransition]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(currentPositionRef.current.zoom - 0.5, 1);
    if (newZoom === 1) {
      isUserZoomedRef.current = false;
    }
    animateTransition(currentPositionRef.current.center, newZoom, 400);
  }, [animateTransition]);

  const handleResetView = useCallback(() => {
    onRegionSelect(null as any);
    isUserZoomedRef.current = false;
    animateTransition([95, 63], 1, 600);
  }, [onRegionSelect, animateTransition]);

  const handleMoveEnd = useCallback((position: { coordinates: [number, number]; zoom: number }) => {
    if (isAnimatingRef.current) return;
    
    currentPositionRef.current = {
      center: position.coordinates,
      zoom: position.zoom
    };
    
    if (position.zoom > 1) {
      isUserZoomedRef.current = true;
    }
  }, []);

  // Мемоизируем название выбранного региона
  const selectedRegionName = useMemo(() => selectedRegion?.name, [selectedRegion]);

  if (isLoading) {
    return (
      <div className="map-loading">
        <div style={{ fontSize: '24px' }}>Загрузка карты...</div>
      </div>
    );
  }

  if (loadedGeographies.length === 0) {
    return (
      <div className="map-error">
        Ошибка загрузки карты. Проверьте консоль браузера.
      </div>
    );
  }

  return (
    <div className="map-fullscreen-container">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ 
          scale: 400, 
          center: [0, 0]
        }}
        width={1600}
        height={900}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup 
          center={center}
          zoom={zoom}
          minZoom={1}
          maxZoom={8}
          onMoveEnd={handleMoveEnd}
          translateExtent={[[-1000, -1000], [2600, 1900]]}
        >
          <Geographies geography={{ type: 'FeatureCollection', features: loadedGeographies }}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const regionData = getCachedRegionData(geo.properties);
                const isSelected = selectedRegionName === regionData.name;

                return (
                  <RegionGeography
                    key={geo.rsmKey}
                    geo={geo}
                    regionData={regionData}
                    isSelected={isSelected}
                    onClick={() => handleRegionClick(geo, regionData)}
                    onMouseEnter={() => onRegionHover(regionData.name)}
                    onMouseLeave={() => onRegionHover(null)}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      <div className="zoom-controls">
        <button className="zoom-button" onClick={handleZoomIn}>+</button>
        <button className="zoom-button" onClick={handleZoomOut}>−</button>
        <button className="zoom-button reset-button" onClick={handleResetView}>↺</button>
      </div>
    </div>
  );
}