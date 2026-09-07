'use client';

import Link from 'next/link';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { addExifToJpeg } from '@/lib/jpegExif';
import { readVideoMetadata, type VideoFileMetadata } from '@/lib/clientVideoMetadata';
import { applyCubeLut, parseCubeLut, type CubeLut } from '@/lib/cubeLut';
import { applyMonochromaticGaussianNoise } from '@/lib/imageEffects';
import {
  applyOrganisation,
  deleteVideoFromDirectory,
  loadOrganisedDays,
  loadVideosFromDirectory,
  markVideoCaptured,
  previewOrganisation,
  writeBlobToDirectory,
  type OrganisedDay,
  type OrganisationPreview,
} from '@/lib/localMediaLibrary';
import {
  deleteHelperVideo,
  detectMediaHelper,
  ejectHelperVolume,
  getAllHelperVideos,
  getHelperDays,
  getHelperJob,
  getHelperVideos,
  helperMediaUrl,
  markHelperVideoCaptured,
  mediaHelperSupports,
  pairMediaHelper,
  rotateHelperVideo,
  saveHelperCapture,
  selectHelperFolder,
  startHelperOrganisation,
  stopHelperOrganisation,
  type HelperDay,
  type HelperJob,
  type HelperPreview,
  type HelperVideo,
} from '@/lib/mediaHelperClient';

type LocalVideo = {
  file?: File;
  fileHandle?: FileSystemFileHandle;
  parentHandle?: FileSystemDirectoryHandle;
  url: string;
  name: string;
  relativePath?: string;
  size: number;
  lastModified: number;
  captured: boolean;
  dayHandle?: FileSystemDirectoryHandle;
  dayLabel?: string;
  helperDayKey?: string;
  helperMetadata?: HelperVideo;
};
type DirectoryPickerWindow = Window & {
  showDirectoryPicker(options?: { id?: string; mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
};
// Content hash prevents a transient deployment-time 404 from remaining in a
// browser or edge cache after the immutable LUT asset becomes available.
const DEFAULT_LUT_URL = '/luts/osmo-action-5-pro.cube?v=735392c7d6b0';

function localDateInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function clock(seconds: number, precise = false) {
  if (!Number.isFinite(seconds)) return '00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const prefix = hours ? `${String(hours).padStart(2, '0')}:` : '';
  return `${prefix}${String(minutes).padStart(2, '0')}:${secs.toFixed(precise ? 3 : 0).padStart(precise ? 6 : 2, '0')}`;
}

function size(bytes: number) {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(bytes > 1024 ** 3 ? 1 : 0)} MB`;
}

function elapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value, index) => index === 0 ? String(value) : String(value).padStart(2, '0'))
    .filter((_, index) => index > 0 || hours > 0)
    .join(':') || '0:00';
}

function captureBasename(date: Date) {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
}

function ordinal(value: number) {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  return `${value}${value % 10 === 1 ? 'st' : value % 10 === 2 ? 'nd' : value % 10 === 3 ? 'rd' : 'th'}`;
}

function captureFolder(date: Date) {
  const monthNumber = String(date.getMonth() + 1).padStart(2, '0');
  const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date);
  return `${date.getFullYear()} / ${monthNumber} - ${monthName} / ${ordinal(date.getDate())}`;
}

function organisedDayValue(key: string) {
  const [year = '0', month = '0', day = '0'] = key.split('/');
  return Number(year) * 10_000 + Number.parseInt(month, 10) * 100 + Number.parseInt(day, 10);
}

function videoIdentity(video: LocalVideo) {
  return video.helperMetadata?.id ?? `${video.relativePath ?? video.name}:${video.lastModified}`;
}

export default function FrameCapturePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videosRef = useRef<LocalVideo[]>([]);
  const cameraFieldsLockedRef = useRef(false);
  const [videos, setVideos] = useState<LocalVideo[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [metadata, setMetadata] = useState<VideoFileMetadata | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDimensions, setVideoDimensions] = useState({ width: 16, height: 9 });
  const [videoRotations, setVideoRotations] = useState<Record<string, number>>({});
  const [startTime, setStartTime] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [lens, setLens] = useState('');
  const [frameRate, setFrameRate] = useState(30);
  const [description, setDescription] = useState('');
  const [lut, setLut] = useState<CubeLut | null>(null);
  const [lutFilename, setLutFilename] = useState('');
  const [lutEnabled, setLutEnabled] = useState(false);
  const [lutStrength, setLutStrength] = useState(100);
  const [lutLoading, setLutLoading] = useState(false);
  const [lutIsBundled, setLutIsBundled] = useState(true);
  const [grainEnabled, setGrainEnabled] = useState(false);
  const [grainStrength, setGrainStrength] = useState(5);
  const [capturing, setCapturing] = useState(false);
  const [notice, setNotice] = useState('');
  const [libraryRoot, setLibraryRoot] = useState<FileSystemDirectoryHandle | null>(null);
  const [libraryPreview, setLibraryPreview] = useState<OrganisationPreview | null>(null);
  const [libraryDays, setLibraryDays] = useState<OrganisedDay[]>([]);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryStatus, setLibraryStatus] = useState('');
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [organisationProgress, setOrganisationProgress] = useState({ completed: 0, total: 0, label: '', bytesCompleted: 0, bytesTotal: 0, startedAt: 0, stopping: false });
  const localStopRequestedRef = useRef(false);
  const [helperAvailable, setHelperAvailable] = useState(false);
  const [helperMode, setHelperMode] = useState(false);
  const [helperPreview, setHelperPreview] = useState<HelperPreview | null>(null);
  const [helperJob, setHelperJob] = useState<HelperJob | null>(null);
  const [helperDays, setHelperDays] = useState<HelperDay[]>([]);
  const [helperNow, setHelperNow] = useState(0);
  const [rotationProgress, setRotationProgress] = useState<{ progress: number; message: string } | null>(null);

  const active = videos[activeIndex] ?? null;
  const organising = Boolean(helperJob?.running) || (libraryBusy && organisationProgress.total > 0);
  const rotationRunning = rotationProgress !== null;
  const navigationLocked = organising || rotationRunning;
  const rotation = active ? videoRotations[videoIdentity(active)] ?? 0 : 0;
  const quarterTurn = rotation % 180 !== 0;
  const displayWidth = quarterTurn ? videoDimensions.height : videoDimensions.width;
  const displayHeight = quarterTurn ? videoDimensions.width : videoDimensions.height;
  const portraitVideo = displayHeight > displayWidth;
  const sortedHelperDays = useMemo(
    () => [...helperDays].sort((a, b) => organisedDayValue(b.key) - organisedDayValue(a.key)),
    [helperDays],
  );
  const sortedLibraryDays = useMemo(
    () => [...libraryDays].sort((a, b) => organisedDayValue(b.key) - organisedDayValue(a.key)),
    [libraryDays],
  );
  const snapshotDate = useMemo(() => {
    const start = new Date(startTime);
    return Number.isNaN(start.getTime()) ? null : new Date(start.getTime() + currentTime * 1000);
  }, [currentTime, startTime]);

  useEffect(() => {
    videosRef.current = videos;
  }, [videos]);

  useEffect(() => () => videosRef.current.forEach(video => {
    if (video.url.startsWith('blob:')) URL.revokeObjectURL(video.url);
  }), []);

  useEffect(() => {
    let cancelled = false;
    void detectMediaHelper().then(async found => {
      if (cancelled) return;
      setHelperAvailable(Boolean(found?.ok));
      if (!found?.ok || 'showDirectoryPicker' in window || !found.paired) return;
      try {
        await pairMediaHelper();
        const status = await getHelperJob();
        if (cancelled || !status.preview) return;
        setHelperMode(true);
        setHelperPreview(status.preview);
        setHelperJob(status.job);
        setHelperDays(status.days);
        setLibraryStatus(status.job.error || status.job.message);
      } catch {
        // The user can reconnect explicitly if the saved pairing has expired.
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('tbs:navigation-lock', { detail: { locked: navigationLocked } }));
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!navigationLocked) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.dispatchEvent(new CustomEvent('tbs:navigation-lock', { detail: { locked: false } }));
    };
  }, [navigationLocked]);

  useEffect(() => {
    if (!organising) return;
    const timer = window.setInterval(() => setHelperNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [organising]);

  useEffect(() => {
    if (!helperJob?.running) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const found = await getHelperJob();
        if (cancelled) return;
        setHelperJob(found.job);
        if (found.preview) setHelperPreview(found.preview);
        if (found.days.length) setHelperDays(found.days);
        setLibraryStatus(found.job.error || found.job.message);
      } catch (error) {
        if (!cancelled) setLibraryStatus(error instanceof Error ? error.message : 'Lost connection to the media helper.');
      }
    };
    const timer = window.setInterval(() => void poll(), 750);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [helperJob?.running]);

  useEffect(() => {
    if (!active) return;
    if (active.helperMetadata) {
      let cancelled = false;
      Promise.resolve().then(() => {
        if (cancelled) return;
        const found: VideoFileMetadata = {
          recordedAt: new Date(active.helperMetadata!.recordedAt),
          recordedAtSource: active.helperMetadata!.recordedAtSource,
          make: 'DJI',
          model: 'OSMO Action 5 Pro',
          lens: '',
          software: '',
          frameRate: active.helperMetadata!.frameRate,
          codec: active.helperMetadata!.codec,
          width: active.helperMetadata!.width,
          height: active.helperMetadata!.height,
          raw: {},
        };
        setMetadata(found);
        setStartTime(localDateInput(found.recordedAt));
        setMake('DJI');
        setModel('OSMO Action 5 Pro');
        if (found.frameRate > 0) setFrameRate(Number(found.frameRate.toFixed(3)));
        setMetadataLoading(false);
      });
      return () => { cancelled = true; };
    }
    if (!active.file) return;
    let cancelled = false;
    readVideoMetadata(active.file)
      .then(found => {
        if (cancelled) return;
        setMetadata(found);
        setStartTime(localDateInput(found.recordedAt));
        if (!cameraFieldsLockedRef.current) {
          setMake(found.make || (/^DJI[_-]/i.test(active.name) ? 'DJI' : ''));
          setModel(found.model);
          setLens(found.lens);
          cameraFieldsLockedRef.current = true;
        }
        if (found.frameRate > 0) setFrameRate(Number(found.frameRate.toFixed(3)));
      })
      .catch(error => {
        if (!cancelled) {
          setMetadataError(error instanceof Error ? error.message : 'Could not read video metadata.');
          setStartTime(localDateInput(new Date(active.lastModified)));
        }
      })
      .finally(() => { if (!cancelled) setMetadataLoading(false); });
    return () => { cancelled = true; };
  }, [active]);

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []).filter(file => file.type.startsWith('video/') || /\.(mp4|mov|m4v)$/i.test(file.name));
    if (!selected.length) return;
    videos.forEach(video => { if (video.url.startsWith('blob:')) URL.revokeObjectURL(video.url); });
    setVideos(selected.map(file => ({
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      captured: false,
    })));
    setActiveIndex(0);
    setMetadata(null);
    setMetadataError('');
    setMetadataLoading(true);
    setCurrentTime(0);
    setDuration(0);
    setVideoDimensions({ width: 16, height: 9 });
    setNotice('');
    event.target.value = '';
  }

  async function connectLibrary() {
    setLibraryBusy(true);
    setLibraryCollapsed(false);
    setOrganisationProgress({ completed: 0, total: 0, label: '', bytesCompleted: 0, bytesTotal: 0, startedAt: 0, stopping: false });
    try {
      if ('showDirectoryPicker' in window) {
        setHelperMode(false);
        setHelperPreview(null);
        setHelperDays([]);
        setHelperJob(null);
        setLibraryStatus('Reading the selected folder…');
        const root = await (window as DirectoryPickerWindow).showDirectoryPicker({ id: 'tbs-frame-capture', mode: 'readwrite' });
        setLibraryRoot(root);
        const [foundPreview, days, foundVideos] = await Promise.all([
          previewOrganisation(root),
          loadOrganisedDays(root),
          loadVideosFromDirectory(root),
        ]);
        setLibraryPreview(foundPreview);
        setLibraryDays(days);
        videos.forEach(video => { if (video.url.startsWith('blob:')) URL.revokeObjectURL(video.url); });
        setVideos(foundVideos.map(video => {
          const parts = video.relativePath.split('/');
          const organised = parts.length === 4 && /^\d{4}$/.test(parts[0]) && /^\d{2} - /.test(parts[1]) && /^(?:\d{1,2})(?:st|nd|rd|th)$/.test(parts[2]);
          return {
            file: video.file,
            fileHandle: video.handle,
            parentHandle: video.parent,
            url: URL.createObjectURL(video.file),
            name: video.file.name,
            relativePath: video.relativePath,
            size: video.file.size,
            lastModified: video.file.lastModified,
            captured: video.captured,
            dayHandle: organised ? video.parent : undefined,
            dayLabel: organised ? `${parts[2]} ${parts[1].replace(/^\d{2} - /, '')} ${parts[0]}` : undefined,
          };
        }));
        setActiveIndex(0);
        setMetadata(null);
        setMetadataError('');
        setMetadataLoading(Boolean(foundVideos.length));
        setCurrentTime(0);
        setDuration(0);
        setVideoDimensions({ width: 16, height: 9 });
        setLibraryStatus(`Connected to ${root.name}. ${foundVideos.length} video${foundVideos.length === 1 ? '' : 's'} loaded from this folder and its subfolders.`);
        return;
      }
      setLibraryStatus('Connecting to the local media helper…');
      const helper = await detectMediaHelper();
      if (!helper?.ok) throw new Error('The macOS media helper is not running. Reinstall or start it, then try again.');
      if (!mediaHelperSupports(helper.version)) throw new Error('The macOS media helper needs updating before it can load folders and manage videos. Re-run tools/media-helper/install.sh, then try again.');
      await pairMediaHelper(!helper.paired);
      setHelperAvailable(true);
      setHelperMode(true);
      setLibraryRoot(null);
      setLibraryPreview(null);
      setLibraryDays([]);
      setLibraryStatus('Choose the root DCIM folder in the macOS dialog…');
      const found = await selectHelperFolder();
      setHelperPreview(found);
      setHelperJob(null);
      const [days, helperVideos] = await Promise.all([getHelperDays(), getAllHelperVideos()]);
      setHelperDays(days.days);
      videos.forEach(video => { if (video.url.startsWith('blob:')) URL.revokeObjectURL(video.url); });
      setVideos(helperVideos.videos.map(video => ({
        url: helperMediaUrl(video.id),
        name: video.name,
        relativePath: video.relativePath,
        size: video.size,
        lastModified: video.lastModified,
        captured: video.captured,
        dayLabel: video.dayLabel,
        helperDayKey: video.dayKey,
        helperMetadata: video,
      })));
      setActiveIndex(0);
      setMetadata(null);
      setMetadataError('');
      setMetadataLoading(Boolean(helperVideos.videos.length));
      setCurrentTime(0);
      setDuration(0);
      setVideoDimensions({ width: 16, height: 9 });
      setLibraryStatus(`Connected to ${found.rootName}. ${helperVideos.videos.length} video${helperVideos.videos.length === 1 ? '' : 's'} loaded from this folder and its subfolders.`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') setLibraryStatus('Folder selection cancelled.');
      else setLibraryStatus(error instanceof Error ? error.message : 'The folder could not be opened.');
    } finally {
      setLibraryBusy(false);
    }
  }

  async function organiseLibrary() {
    setLibraryCollapsed(false);
    if (helperMode && helperPreview?.actionCount) {
      setLibraryBusy(true);
      setLibraryStatus('Starting the local organisation job…');
      try {
        const found = await startHelperOrganisation();
        setHelperJob(found.job);
        setHelperNow(Date.now());
        setLibraryStatus(found.job.message);
      } catch (error) {
        setLibraryStatus(error instanceof Error ? error.message : 'The helper could not start the organisation job.');
      } finally {
        setLibraryBusy(false);
      }
      return;
    }
    if (!libraryRoot || !libraryPreview || !libraryPreview.actions.length) return;
    setLibraryBusy(true);
    localStopRequestedRef.current = false;
    setOrganisationProgress({ completed: 0, total: libraryPreview.actions.length, label: 'Starting…', bytesCompleted: 0, bytesTotal: libraryPreview.actions.reduce((total, action) => total + (action.kind === 'move' ? action.file.size : 0), 0), startedAt: Date.now(), stopping: false });
    setLibraryStatus('Organising media. Keep this tab and the SD card connected…');
    try {
      const result = await applyOrganisation(
        libraryRoot,
        libraryPreview,
        (completed, total, label, bytesCompleted, bytesTotal) => setOrganisationProgress(current => ({ ...current, completed, total, label, bytesCompleted, bytesTotal })),
        () => localStopRequestedRef.current,
      );
      const [preview, days] = await Promise.all([previewOrganisation(libraryRoot), loadOrganisedDays(libraryRoot)]);
      setLibraryPreview(preview);
      setLibraryDays(days);
      setLibraryStatus(result.stopped
        ? 'Stopped safely before starting another file. The card is not yet safe to remove; eject it through Finder.'
        : `Organisation complete. ${days.length} day${days.length === 1 ? '' : 's'} available.`);
    } catch (error) {
      setLibraryStatus(error instanceof Error ? error.message : 'Organisation stopped unexpectedly. Uncopied originals were retained.');
    } finally {
      setLibraryBusy(false);
    }
  }

  async function openLibraryDay(day: OrganisedDay) {
    setLibraryBusy(true);
    setLibraryStatus(`Opening ${day.label}…`);
    try {
      const foundVideos = await loadVideosFromDirectory(day.handle, false);
      videos.forEach(video => { if (video.url.startsWith('blob:')) URL.revokeObjectURL(video.url); });
      setVideos(foundVideos.map(video => ({
        file: video.file,
        fileHandle: video.handle,
        parentHandle: day.handle,
        url: URL.createObjectURL(video.file),
        name: video.file.name,
        relativePath: video.relativePath,
        size: video.file.size,
        lastModified: video.file.lastModified,
        captured: video.captured,
        dayHandle: day.handle,
        dayLabel: day.label,
      })));
      setActiveIndex(0);
      setMetadata(null);
      setMetadataError('');
      setMetadataLoading(true);
      setCurrentTime(0);
      setDuration(0);
      setVideoDimensions({ width: 16, height: 9 });
      cameraFieldsLockedRef.current = true;
      setMake('DJI');
      setModel('OSMO Action 5 Pro');
      setLibraryStatus(`${day.label}: ${foundVideos.length} video${foundVideos.length === 1 ? '' : 's'} loaded.`);
    } catch (error) {
      setLibraryStatus(error instanceof Error ? error.message : 'The selected day could not be opened.');
    } finally {
      setLibraryBusy(false);
    }
  }

  async function openHelperDay(day: HelperDay) {
    setLibraryBusy(true);
    setLibraryStatus(`Opening ${day.label}…`);
    try {
      const found = await getHelperVideos(day.key);
      videos.forEach(video => { if (video.url.startsWith('blob:')) URL.revokeObjectURL(video.url); });
      setVideos(found.videos.map(video => ({
        url: helperMediaUrl(video.id),
        name: video.name,
        size: video.size,
        lastModified: video.lastModified,
        relativePath: video.relativePath,
        captured: video.captured,
        dayLabel: day.label,
        helperDayKey: day.key,
        helperMetadata: video,
      })));
      setActiveIndex(0);
      setMetadata(null);
      setMetadataError('');
      setMetadataLoading(true);
      setCurrentTime(0);
      setDuration(0);
      setVideoDimensions({ width: 16, height: 9 });
      cameraFieldsLockedRef.current = true;
      setMake('DJI');
      setModel('OSMO Action 5 Pro');
      setLibraryStatus(`${day.label}: ${found.videos.length} video${found.videos.length === 1 ? '' : 's'} loaded through the local helper.`);
    } catch (error) {
      setLibraryStatus(error instanceof Error ? error.message : 'The selected day could not be opened.');
    } finally {
      setLibraryBusy(false);
    }
  }

  async function stopSafely() {
    if (!helperMode) {
      localStopRequestedRef.current = true;
      setOrganisationProgress(current => ({ ...current, stopping: true }));
      setLibraryStatus('Stop requested. Finishing and verifying the current file safely…');
      return;
    }
    try {
      const found = await stopHelperOrganisation();
      setHelperJob(found.job);
      setLibraryStatus(found.job.message);
    } catch (error) {
      setLibraryStatus(error instanceof Error ? error.message : 'The stop request could not be sent.');
    }
  }

  async function ejectCard() {
    setLibraryBusy(true);
    try {
      const found = await ejectHelperVolume();
      setLibraryStatus(found.message);
      setHelperPreview(null);
      setHelperDays([]);
      setHelperJob(null);
      videos.forEach(video => { if (video.url.startsWith('blob:')) URL.revokeObjectURL(video.url); });
      setVideos([]);
    } catch (error) {
      setLibraryStatus(error instanceof Error ? error.message : 'The SD card could not be ejected.');
    } finally {
      setLibraryBusy(false);
    }
  }

  function selectVideo(index: number) {
    setActiveIndex(index);
    setMetadata(null);
    setMetadataError('');
    setMetadataLoading(true);
    setCurrentTime(0);
    setDuration(0);
    setVideoDimensions({ width: 16, height: 9 });
    setNotice('');
  }

  async function rotateVideo(direction: -1 | 1) {
    if (!active?.helperMetadata || rotationRunning) {
      setNotice('Saving video rotation requires the current macOS media helper.');
      return;
    }
    const key = videoIdentity(active);
    const degrees: -90 | 90 = direction === -1 ? -90 : 90;
    videoRef.current?.pause();
    setRotationProgress({ progress: 0, message: 'Preparing video rotation…' });
    setNotice('');
    try {
      const rotated = await rotateHelperVideo(active.helperMetadata.id, degrees, (progress, message) => {
        setRotationProgress({ progress, message });
      });
      setVideos(current => current.map((video, index) => index === activeIndex ? {
        ...video,
        url: helperMediaUrl(rotated.id, rotated.lastModified),
        name: rotated.name,
        relativePath: rotated.relativePath,
        size: rotated.size,
        lastModified: rotated.lastModified,
        captured: rotated.captured,
        dayLabel: rotated.dayLabel,
        helperDayKey: rotated.dayKey,
        helperMetadata: rotated,
      } : video));
      setVideoRotations(current => ({ ...current, [key]: 0 }));
      setCurrentTime(0);
      setDuration(0);
      setVideoDimensions({ width: 16, height: 9 });
      setNotice(`Saved rotation to ${active.name} and safely replaced the original on disk.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The video could not be rotated; the original was retained.');
    } finally {
      setRotationProgress(null);
    }
  }

  async function deleteActiveVideo() {
    if (!active) return;
    const canDelete = Boolean(active.helperMetadata || active.parentHandle);
    const action = canDelete ? (active.helperMetadata ? 'move to Trash' : 'permanently delete') : 'remove from this selection';
    if (!window.confirm(`Do you want to ${action} “${active.name}”?`)) return;
    setLibraryBusy(true);
    try {
      let message = `${active.name} was removed from this selection.`;
      if (active.helperMetadata) {
        message = (await deleteHelperVideo(active.helperMetadata.id)).message;
      } else if (active.parentHandle) {
        await deleteVideoFromDirectory(active.parentHandle, active.name);
        message = `${active.name} was permanently deleted from the connected folder.`;
      }
      if (active.url.startsWith('blob:')) URL.revokeObjectURL(active.url);
      setVideos(current => current.filter((_, index) => index !== activeIndex));
      setActiveIndex(index => Math.max(0, Math.min(index, videos.length - 2)));
      setMetadata(null);
      setMetadataError('');
      setMetadataLoading(videos.length > 1);
      setCurrentTime(0);
      setDuration(0);
      setVideoDimensions({ width: 16, height: 9 });
      setLibraryStatus(message);
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The video could not be deleted.');
    } finally {
      setLibraryBusy(false);
    }
  }

  function seek(time: number) {
    const video = videoRef.current;
    if (!video) return;
    const target = Math.max(0, Math.min(time, Math.max(0, duration - 0.001)));
    video.pause();
    video.currentTime = target;
    setCurrentTime(target);
  }

  function stepFrame(direction: -1 | 1) {
    seek(currentTime + direction / Math.max(1, frameRate));
  }

  async function loadBundledLut(enable = true) {
    setLutLoading(true);
    try {
      const response = await fetch(DEFAULT_LUT_URL);
      if (!response.ok) throw new Error(`Could not load the bundled LUT (${response.status}).`);
      const parsed = parseCubeLut(await response.text(), 'OSMO Action 5 Pro');
      setLut(parsed);
      setLutFilename('OSMO Action 5 Pro.cube');
      setLutIsBundled(true);
      setLutEnabled(enable);
      setNotice('');
    } catch (error) {
      setLutEnabled(false);
      setNotice(error instanceof Error ? error.message : 'The bundled LUT could not be loaded.');
    } finally {
      setLutLoading(false);
    }
  }

  async function chooseLut(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = parseCubeLut(await file.text(), file.name.replace(/\.cube$/i, ''));
      setLut(parsed);
      setLutFilename(file.name);
      setLutIsBundled(false);
      setLutEnabled(true);
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The LUT could not be read.');
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || !active || !snapshotDate || !video.videoWidth || !video.videoHeight) return;
    setCapturing(true);
    setNotice('');
    try {
      video.pause();
      const canvas = document.createElement('canvas');
      const rotated = rotation % 180 !== 0;
      canvas.width = rotated ? video.videoHeight : video.videoWidth;
      canvas.height = rotated ? video.videoWidth : video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser could not create a capture canvas.');
      context.save();
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate(rotation * Math.PI / 180);
      context.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2, video.videoWidth, video.videoHeight);
      context.restore();

      const createJpeg = async (version: 'RAW' | 'EDITED') => {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(value => value ? resolve(value) : reject(new Error('JPEG encoding failed.')), 'image/jpeg', 0.96);
        });
        const jpeg = new Uint8Array(await blob.arrayBuffer());
        const grading = version === 'EDITED' ? [
          lut && lutEnabled ? `LUT: ${lut.title} (${lutStrength}%)` : '',
          grainEnabled ? `Noise: ${grainStrength}% monochromatic Gaussian` : '',
        ].filter(Boolean) : [];
        const withExif = addExifToJpeg(jpeg, {
          capturedAt: snapshotDate,
          make: make.trim(),
          model: model.trim(),
          lens: lens.trim(),
          software: 'The Break Surf Frame Capture',
          description: [
            description.trim(),
            `Version: ${version}${version === 'RAW' ? ' (ungraded video frame)' : ''}`,
            rotation ? `Rotation: ${rotation}° clockwise` : '',
            metadata?.software ? `Camera software: ${metadata.software}` : '',
            ...grading,
          ].filter(Boolean).join(' | '),
          sourceFile: active.name,
          offsetSeconds: currentTime,
        });
        return new Blob([withExif], { type: 'image/jpeg' });
      };

      const rawOutput = await createJpeg('RAW');
      if (lut && lutEnabled) {
        // Yield once so the loading state paints before processing a large 4K frame.
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        context.putImageData(applyCubeLut(pixels, lut, lutStrength / 100), 0, 0);
      }
      if (grainEnabled) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        context.putImageData(applyMonochromaticGaussianNoise(pixels, grainStrength / 100), 0, 0);
      }
      const editedOutput = await createJpeg('EDITED');
      const basename = captureBasename(snapshotDate);
      const outputs = [
        { blob: rawOutput, filename: `${basename}_RAW.jpg` },
        { blob: editedOutput, filename: `${basename}_EDITED.jpg` },
      ];
      if (active.helperDayKey) {
        const saved = [];
        for (const output of outputs) {
          const result = await saveHelperCapture(active.helperDayKey, output.filename, output.blob);
          saved.push(result.filename);
        }
        setNotice(`Saved ${saved.join(' and ')} to ${active.dayLabel ?? 'the organised day folder'} through the local helper with embedded EXIF metadata.`);
      } else if (active.dayHandle) {
        const saved = [];
        for (const output of outputs) saved.push(await writeBlobToDirectory(active.dayHandle, output.filename, output.blob));
        setNotice(`Saved ${saved.join(' and ')} to ${active.dayLabel ?? 'the organised day folder'} with embedded EXIF metadata.`);
      } else {
        outputs.forEach(({ blob, filename }) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
        });
        setNotice(`Downloaded ${basename}_RAW.jpg and ${basename}_EDITED.jpg with embedded EXIF metadata.`);
      }
      if (active.helperMetadata) await markHelperVideoCaptured(active.helperMetadata.id);
      else if (active.parentHandle) await markVideoCaptured(active.parentHandle, active.name);
      setVideos(current => current.map((video, index) => index === activeIndex ? { ...video, captured: true } : video));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The snapshot could not be created.');
    } finally {
      setCapturing(false);
    }
  }

  const helperElapsedMs = helperJob?.startedAt
    ? (helperJob.finishedAt ?? helperNow) - helperJob.startedAt
    : 0;
  const helperSpeed = helperJob?.bytesCompleted && helperElapsedMs > 0
    ? helperJob.bytesCompleted / (helperElapsedMs / 1000)
    : 0;
  const helperEtaMs = helperJob?.running && helperSpeed > 0
    ? (helperJob.bytesTotal - helperJob.bytesCompleted) / helperSpeed * 1000
    : 0;
  const helperProgress = helperJob?.total
    ? helperJob.completed / helperJob.total * 100
    : 0;
  const localElapsedMs = organisationProgress.startedAt ? helperNow - organisationProgress.startedAt : 0;
  const localSpeed = organisationProgress.bytesCompleted && localElapsedMs > 0
    ? organisationProgress.bytesCompleted / (localElapsedMs / 1000)
    : 0;
  const localEtaMs = localSpeed > 0
    ? (organisationProgress.bytesTotal - organisationProgress.bytesCompleted) / localSpeed * 1000
    : 0;

  return (
    <div className="mx-auto min-h-full max-w-[1500px] p-8">
      <div className="mb-7 flex items-start justify-between gap-6">
        <div>
          {navigationLocked
            ? <span className="mb-3 inline-flex cursor-not-allowed text-xs font-medium text-gray-300">← Social</span>
            : <Link href="/admin/social" className="mb-3 inline-flex text-xs font-medium text-gray-400 hover:text-gray-700">← Social</Link>}
          <h1 className="text-xl font-semibold text-gray-900">Frame capture</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">Open a camera folder, browse every video inside it, and save full-resolution RAW and Edited JPEGs with corrected capture-time EXIF.</p>
          <p className={`mt-1 text-[10px] font-medium ${helperAvailable ? 'text-green-600' : 'text-gray-400'}`}>{helperAvailable ? 'Local macOS helper ready' : 'Browser folder access fallback'}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={libraryBusy || navigationLocked} onClick={() => void connectLibrary()} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40">Choose video folder</button>
          <label className={`rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${navigationLocked ? 'pointer-events-none cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-gray-50'}`}>
            Choose videos
            <input type="file" disabled={navigationLocked} accept="video/*,.mp4,.mov,.m4v" multiple className="sr-only" onChange={chooseFiles} />
          </label>
        </div>
      </div>

      {(libraryRoot || helperMode || libraryStatus) && (
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-5">
            <button
              type="button"
              aria-expanded={!libraryCollapsed}
              disabled={organising}
              onClick={() => setLibraryCollapsed(collapsed => !collapsed)}
              className="group flex min-w-0 flex-1 items-start justify-between gap-4 text-left disabled:cursor-not-allowed"
              title={organising ? 'The library panel stays open while media is being organised.' : libraryCollapsed ? 'Expand connected folder details' : 'Collapse connected folder details'}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{helperPreview?.rootName ?? libraryRoot?.name ?? 'Local media library'}</p>
                  {helperMode && <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-green-700">macOS helper</span>}
                </div>
                <p className="mt-1 truncate text-xs leading-5 text-gray-500">{libraryStatus}</p>
              </div>
            </button>
            <div className="flex shrink-0 gap-2">
              {organising && (
                <button type="button" disabled={helperJob?.stopping || organisationProgress.stopping} onClick={() => void stopSafely()} className="rounded-md border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40">
                  {helperJob?.stopping || organisationProgress.stopping ? 'Stopping safely…' : 'Stop safely'}
                </button>
              )}
              {helperMode && helperPreview && !helperJob?.running && (
                <button type="button" disabled={libraryBusy || rotationRunning} onClick={() => void ejectCard()} className="rounded-md border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                  Eject SD card
                </button>
              )}
            {(helperMode ? Boolean(helperPreview?.actionCount) : Boolean(libraryPreview?.actions.length)) && !helperJob?.running && (
              <button type="button" disabled={libraryBusy || rotationRunning} onClick={() => void organiseLibrary()} className="shrink-0 rounded-md bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-40">
                {helperMode
                  ? `Organise ${helperPreview?.moveCount ?? 0} files & trash ${helperPreview?.trashCount ?? 0} LRFs`
                  : `Organise ${libraryPreview?.moveCount ?? 0} files & delete ${libraryPreview?.deleteCount ?? 0} LRFs`}
              </button>
            )}
            </div>
          </div>
          {!libraryCollapsed && (
            <>
          {helperJob?.running && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between text-[10px] font-medium text-amber-800">
                <span>Organising media — do not close this tab or remove the SD card</span>
                <span>{helperProgress.toFixed(1)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${helperProgress}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-amber-800 sm:grid-cols-5">
                <span>{helperJob.completed} of {helperJob.total} files</span>
                <span>{size(helperJob.bytesCompleted)} of {size(helperJob.bytesTotal)}</span>
                <span>Elapsed {elapsed(helperElapsedMs)}</span>
                <span>{helperSpeed ? `${size(helperSpeed)}/s` : 'Calculating speed…'}</span>
                <span>{helperEtaMs ? `ETA ${elapsed(helperEtaMs)}` : 'Calculating ETA…'}</span>
              </div>
              <p className="mt-2 truncate text-[10px] text-amber-700">{helperJob.currentFile || helperJob.message}</p>
            </div>
          )}
          {libraryBusy && organisationProgress.total > 0 && !helperMode && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between text-[10px] font-medium text-amber-800">
                <span>Organising media — do not close this tab or remove the SD card</span>
                <span>{(organisationProgress.completed / organisationProgress.total * 100).toFixed(1)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${organisationProgress.completed / organisationProgress.total * 100}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-amber-800 sm:grid-cols-5">
                <span>{organisationProgress.completed} of {organisationProgress.total} files</span>
                <span>{size(organisationProgress.bytesCompleted)} of {size(organisationProgress.bytesTotal)}</span>
                <span>Elapsed {elapsed(localElapsedMs)}</span>
                <span>{localSpeed ? `${size(localSpeed)}/s` : 'Calculating speed…'}</span>
                <span>{localEtaMs ? `ETA ${elapsed(localEtaMs)}` : 'Calculating ETA…'}</span>
              </div>
              <p className="mt-2 truncate text-[10px] text-amber-700">{organisationProgress.label}</p>
            </div>
          )}
          {helperPreview && helperPreview.actionCount > 0 && !helperJob?.running && (
            <div className="mt-4 rounded-xl bg-gray-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Helper preview</p>
              <div className="mt-2 space-y-1">
                {helperPreview.actions.slice(0, 6).map(action => (
                  <p key={action.sourcePath} className="truncate text-[10px] text-gray-500">
                    {action.kind === 'trash' ? 'Move to Trash' : 'Move'} · {action.sourcePath}{action.targetPath ? ` → ${action.targetPath}` : ''}
                  </p>
                ))}
                {helperPreview.actionCount > 6 && <p className="text-[10px] text-gray-400">+ {helperPreview.actionCount - 6} more changes</p>}
              </div>
              {!!helperPreview.skipped.length && <p className="mt-2 text-[10px] text-amber-600">{helperPreview.skipped.length} file{helperPreview.skipped.length === 1 ? '' : 's'} skipped and retained.</p>}
            </div>
          )}
          {libraryPreview && libraryPreview.actions.length > 0 && !libraryBusy && (
            <div className="mt-4 rounded-xl bg-gray-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Preview</p>
              <div className="mt-2 space-y-1">
                {libraryPreview.actions.slice(0, 6).map(action => <p key={action.sourcePath} className="truncate text-[10px] text-gray-500">{action.kind === 'delete' ? 'Delete' : 'Move'} · {action.sourcePath}{action.targetName ? ` → ${action.targetFolders?.join(' / ')} / ${action.targetName}` : ''}</p>)}
                {libraryPreview.actions.length > 6 && <p className="text-[10px] text-gray-400">+ {libraryPreview.actions.length - 6} more changes</p>}
              </div>
              {!!libraryPreview.skipped.length && <p className="mt-2 text-[10px] text-amber-600">{libraryPreview.skipped.length} file{libraryPreview.skipped.length === 1 ? '' : 's'} skipped; unmatched legacy snapshots are retained.</p>}
            </div>
          )}
          {!!helperDays.length && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Organised days</p>
              <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {sortedHelperDays.map(day => (
                  <button key={day.key} type="button" disabled={libraryBusy || rotationRunning || helperJob?.running} onClick={() => void openHelperDay(day)} className="shrink-0 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900 disabled:opacity-40">
                    {day.label} · {day.videoCount}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!!libraryDays.length && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Organised days</p>
              <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{sortedLibraryDays.map(day => <button key={day.key} type="button" disabled={libraryBusy || rotationRunning} onClick={() => void openLibraryDay(day)} className="shrink-0 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900 disabled:opacity-40">{day.label} · {day.videos.length}</button>)}</div>
            </div>
          )}
            </>
          )}
        </section>
      )}

      {!active ? (
        <label className="flex min-h-[420px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center hover:border-gray-400">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl text-gray-400">▶</span>
          <span className="text-sm font-semibold text-gray-800">Use “Choose video folder” above, or select individual videos here</span>
          <span className="mt-2 max-w-md text-xs leading-5 text-gray-400">Connected files stay on this device. Nothing is uploaded to The Break Surf.</span>
          <input type="file" accept="video/*,.mp4,.mov,.m4v" multiple className="sr-only" onChange={chooseFiles} />
        </label>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_330px] gap-6">
          <section className="min-w-0">
            <div
              className={`relative mx-auto overflow-hidden rounded-2xl bg-black shadow-sm ${
                portraitVideo ? 'h-[75vh] max-h-[900px] w-auto max-w-full' : 'max-h-[64vh] w-full'
              }`}
              style={{ aspectRatio: `${displayWidth} / ${displayHeight}` }}
            >
              <video
                key={active.url}
                ref={videoRef}
                crossOrigin={active.helperMetadata ? 'anonymous' : undefined}
                src={active.url}
                preload="auto"
                playsInline
                className="absolute left-1/2 top-1/2 block object-contain"
                style={{
                  width: quarterTurn ? `${videoDimensions.width / videoDimensions.height * 100}%` : '100%',
                  height: quarterTurn ? `${videoDimensions.height / videoDimensions.width * 100}%` : '100%',
                  transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                }}
                onLoadedMetadata={event => {
                  const video = event.currentTarget;
                  const loadedDuration = video.duration || 0;
                  video.pause();
                  setDuration(loadedDuration);
                  setCurrentTime(video.currentTime || 0);
                  setVideoDimensions({
                    width: video.videoWidth || 16,
                    height: video.videoHeight || 9,
                  });
                  if (video.currentTime === 0 && loadedDuration > 0) video.currentTime = Math.min(0.001, loadedDuration);
                }}
                onLoadedData={event => event.currentTarget.pause()}
                onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
                onSeeked={event => setCurrentTime(event.currentTarget.currentTime)}
                onError={() => setNotice('This browser cannot decode the selected video codec. Try a browser with HEVC support or record in H.264.')}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <input
                aria-label="Video position"
                type="range"
                min={0}
                max={duration || 0}
                step="any"
                value={Math.min(currentTime, duration || 0)}
                onChange={event => seek(Number(event.target.value))}
                className="w-full accent-gray-900"
              />
              {rotationProgress && (
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-center justify-between gap-3 text-[10px] font-medium text-blue-800">
                    <span>{rotationProgress.message}</span>
                    <span>{(rotationProgress.progress * 100).toFixed(0)}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${rotationProgress.progress * 100}%` }} />
                  </div>
                  <p className="mt-2 text-[10px] text-blue-700">Keep this tab and the video drive connected until saving finishes.</p>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" aria-label="Previous video" title="Previous video" disabled={rotationRunning || activeIndex === 0} onClick={() => selectVideo(activeIndex - 1)} className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">←</button>
                  <button type="button" aria-label="Next video" title="Next video" disabled={rotationRunning || activeIndex === videos.length - 1} onClick={() => selectVideo(activeIndex + 1)} className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">→</button>
                  <button type="button" disabled={rotationRunning} onClick={() => stepFrame(-1)} className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">− 1 frame</button>
                  <button
                    type="button"
                    disabled={rotationRunning}
                    onClick={() => {
                      const video = videoRef.current;
                      if (!video) return;
                      if (video.paused) void video.play();
                      else video.pause();
                    }}
                    className="rounded-md border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >Play / pause</button>
                  <button type="button" disabled={rotationRunning} onClick={() => stepFrame(1)} className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">+ 1 frame</button>
                  <button type="button" aria-label="Rotate video left" disabled={rotationRunning || !active.helperMetadata} onClick={() => void rotateVideo(-1)} className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-base font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40" title={active.helperMetadata ? 'Rotate left 90° and replace the original video' : 'Saving video rotation requires the macOS media helper'}>↺</button>
                  <button type="button" aria-label="Rotate video right" disabled={rotationRunning || !active.helperMetadata} onClick={() => void rotateVideo(1)} className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-base font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40" title={active.helperMetadata ? 'Rotate right 90° and replace the original video' : 'Saving video rotation requires the macOS media helper'}>↻</button>
                </div>
                <div className="flex items-center gap-2">
                  <p className="ml-1 font-mono text-xs text-gray-500"><span className="text-gray-900">{clock(currentTime, true)}</span> / {clock(duration)}</p>
                </div>
              </div>
            </div>

            {videos.length > 1 && (
              <div className="mt-5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Selected videos</p>
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                  {videos.map((video, index) => (
                    <button key={`${video.relativePath ?? video.name}-${video.lastModified}`} type="button" disabled={rotationRunning} onClick={() => selectVideo(index)}
                      className={`min-w-0 rounded-xl border p-3 text-left ${
                        video.captured
                          ? index === activeIndex ? 'border-green-700 bg-green-100' : 'border-green-400 bg-green-50 hover:bg-green-100'
                          : index === activeIndex ? 'border-gray-900 bg-white' : 'border-gray-200 bg-gray-50 hover:bg-white'
                      }`}>
                      <p className="truncate text-xs font-semibold text-gray-800">{video.name}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className={`text-[10px] ${video.captured ? 'text-green-700' : 'text-gray-400'}`}>{size(video.size)}</p>
                        {video.captured && <span className="text-[9px] font-semibold uppercase tracking-wide text-green-700">Captures made</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="self-start rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-semibold text-gray-900" title={active.relativePath ?? active.name}>{active.name}</p>
                <button
                  type="button"
                  disabled={libraryBusy || capturing || rotationRunning}
                  onClick={() => void deleteActiveVideo()}
                  className="shrink-0 text-[10px] font-semibold text-red-500 hover:text-red-700 disabled:opacity-40"
                >
                  {active.helperMetadata ? 'Move to Trash' : active.parentHandle ? 'Delete video' : 'Remove'}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {metadataLoading ? 'Reading video metadata…' : [metadata?.codec?.toUpperCase(), metadata?.width && metadata.height ? `${metadata.width}×${metadata.height}` : '', size(active.size)].filter(Boolean).join(' · ')}
              </p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-gray-600">
                  Recording started
                  {metadata && <span className="text-[10px] font-normal text-gray-400">from {metadata.recordedAtSource}</span>}
                </span>
                <input type="datetime-local" step="1" value={startTime} onChange={event => setStartTime(event.target.value)} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-400" />
              </label>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Snapshot time</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{snapshotDate ? snapshotDate.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' }) : 'Set recording time'}</p>
                <p className="mt-1 text-[10px] text-gray-400">Recording start + {clock(currentTime, true)}</p>
                {snapshotDate && <p className="mt-2 text-[10px] leading-4 text-gray-400">Folder: {captureFolder(snapshotDate)}</p>}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-600">Camera make</span>
                <input value={make} onChange={event => { cameraFieldsLockedRef.current = true; setMake(event.target.value); }} placeholder="e.g. DJI" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-400" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-600">Camera model</span>
                <input value={model} onChange={event => { cameraFieldsLockedRef.current = true; setModel(event.target.value); }} placeholder="e.g. Osmo Action 5 Pro" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-400" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-600">Lens</span>
                <input value={lens} onChange={event => { cameraFieldsLockedRef.current = true; setLens(event.target.value); }} placeholder="Optional lens description" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-400" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-600">Frame rate</span>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" max="240" step="0.001" value={frameRate} onChange={event => setFrameRate(Number(event.target.value) || 30)} className="min-w-0 flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-400" />
                  <span className="text-xs text-gray-400">fps</span>
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-600">Description</span>
                <input value={description} onChange={event => setDescription(event.target.value)} placeholder="Optional caption or context" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-400" />
              </label>

              <div className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700">Apply colour LUT</p>
                    <p className="mt-0.5 truncate text-[10px] text-gray-400" title={lutFilename || undefined}>
                      {lut ? `${lut.title} · ${lut.size}³` : lutLoading ? 'Loading bundled LUT…' : 'OSMO Action 5 Pro · bundled 64³'}
                    </p>
                  </div>
                  <button type="button" role="switch" aria-checked={lutEnabled} disabled={lutLoading}
                    onClick={() => lut ? setLutEnabled(enabled => !enabled) : void loadBundledLut(true)}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-30 ${lutEnabled ? 'bg-gray-900' : 'bg-gray-200'}`}>
                    <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${lutEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <label className="mt-3 block cursor-pointer rounded-md border border-dashed border-gray-200 px-3 py-2 text-center text-[11px] font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700">
                  Choose custom .cube LUT
                  <input type="file" accept=".cube,text/plain" className="sr-only" onChange={chooseLut} />
                </label>
                {lut && !lutIsBundled && (
                  <button type="button" onClick={() => void loadBundledLut(lutEnabled)} className="mt-2 w-full text-center text-[10px] font-medium text-gray-400 hover:text-gray-700">
                    Reset to OSMO Action 5 Pro
                  </button>
                )}
                {lut && (
                  <label className="mt-3 block">
                    <span className="mb-1 flex justify-between text-[10px] text-gray-400"><span>Strength</span><span>{lutStrength}%</span></span>
                    <input type="range" min="0" max="100" step="1" value={lutStrength} onChange={event => setLutStrength(Number(event.target.value))} className="w-full accent-gray-900" />
                  </label>
                )}
                <p className="mt-2 text-[10px] leading-4 text-gray-400">Applied to the Edited JPEG; the source video and RAW JPEG remain unchanged.</p>
              </div>

              <div className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-gray-700">Film grain</p>
                    <p className="mt-0.5 text-[10px] text-gray-400">{grainStrength}% · monochromatic · Gaussian</p>
                  </div>
                  <button type="button" role="switch" aria-label="Apply film grain" aria-checked={grainEnabled} onClick={() => setGrainEnabled(enabled => !enabled)}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${grainEnabled ? 'bg-gray-900' : 'bg-gray-200'}`}>
                    <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${grainEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <label className="mt-3 block">
                  <span className="mb-1 flex justify-between text-[10px] text-gray-400"><span>Amount</span><span>{grainStrength}%</span></span>
                  <input type="range" min="0" max="100" step="1" value={grainStrength} onChange={event => setGrainStrength(Number(event.target.value))} className="w-full accent-gray-900" />
                </label>
              </div>
            </div>

            {metadataError && <p className="mt-4 text-xs leading-5 text-amber-600">{metadataError}</p>}
            <p className="mt-5 text-[10px] leading-4 text-gray-400">Camera fields are read from standard MP4/QuickTime metadata when available. Review them before export; some DJI models keep additional values in proprietary tracks.</p>

            <button type="button" disabled={capturing || rotationRunning || !snapshotDate} onClick={capture}
              className="mt-5 w-full rounded-md bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40">
              {capturing ? 'Creating JPEG pair…' : active.dayHandle || active.helperDayKey ? 'Save RAW + Edited to day' : 'Capture RAW + Edited JPEGs'}
            </button>
            {notice && <p className={`mt-3 text-xs leading-5 ${/^(Downloaded|Saved)/.test(notice) ? 'text-green-600' : 'text-red-500'}`}>{notice}</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
