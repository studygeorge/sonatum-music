'use client';

import { RegionData } from '../data/regionsData';

interface RegionInfoCardProps {
  region: RegionData;
  onClose: () => void;
}

export default function RegionInfoCard({ region, onClose }: RegionInfoCardProps) {
  return (
    <div className="region-card">
      <div className="region-card-header">
        <div className="region-color-badge" style={{ backgroundColor: region.color }} />
        <h2 className="region-name">{region.name}</h2>
      </div>

      <div className="region-stats">
        <div className="stat-item">
          <div className="stat-label">Композиторов</div>
          <div className="stat-value">{region.composers.length}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Произведений</div>
          <div className="stat-value">{region.tracks}</div>
        </div>
      </div>

      <div className="composers-list">
        <h3 className="composers-title">Композиторы региона</h3>
        {region.composers.map((composer: string, i: number) => (
          <div key={i} className="composer-item">
            {composer}
          </div>
        ))}
      </div>

      <button className="close-button" onClick={onClose} type="button">
        Закрыть
      </button>
    </div>
  );
}