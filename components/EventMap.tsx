'use client';

interface Props {
  location: string;
  coords?: [number, number];
}

export default function EventMap({ location, coords }: Props) {
  const mapsUrl = coords
    ? `https://www.google.com/maps?q=${coords[0]},${coords[1]}`
    : `https://www.google.com/maps?q=${encodeURIComponent(location)}`;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-full w-full items-center justify-center bg-sage/10 text-sm text-charcoal/60 hover:bg-sage/20 transition-colors"
    >
      View on Google Maps
    </a>
  );
}
