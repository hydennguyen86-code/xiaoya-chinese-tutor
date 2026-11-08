/** Group syllabus volumes into one learning track per level, keeping the syllabus order. */
export interface TrackVolume {
  id: string;
  title: string;
  trackId?: string;
  trackTitle?: string;
}

export interface CourseTrack<V extends TrackVolume = TrackVolume> {
  id: string;
  title: string;
  volumes: V[];
}

/** A volume without a trackId is a track of its own, so older or custom syllabi still list every volume. */
export function trackIdOf(volume: TrackVolume): string {
  return volume.trackId || volume.id;
}

export function groupTracks<V extends TrackVolume>(volumes: V[]): CourseTrack<V>[] {
  const tracks: CourseTrack<V>[] = [];
  for (const volume of volumes) {
    const id = trackIdOf(volume);
    const found = tracks.find((track) => track.id === id);
    if (found) found.volumes.push(volume);
    else tracks.push({ id, title: volume.trackTitle || volume.title, volumes: [volume] });
  }
  return tracks;
}
