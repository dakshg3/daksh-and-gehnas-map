export type Memory = {
  id: string;
  file: string; // /photos/...
  latitude: number | null;
  longitude: number | null;
  locationName: string;
  date: string; // YYYY-MM-DD
  caption: string;
  detectedLatitude?: number | null;
  detectedLongitude?: number | null;
  detectedLocationName?: string;
  detectedDate?: string;
  isEdited?: boolean;
  needsReview?: boolean;
};

export type MemoryCluster = {
  locationId: string;
  latitude: number;
  longitude: number;
  locationName: string;
  photos: Memory[];
};
