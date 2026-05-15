'use client';

interface RegionHoverCardProps {
  regionName: string;
}

export default function RegionHoverCard({ regionName }: RegionHoverCardProps) {
  return (
    <div className="hover-label">
      {regionName}
    </div>
  );
}
